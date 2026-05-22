import { randomUUID } from "node:crypto";
import { compactMessages, estimateMessagesTokenCount, type CompactionResult } from "./compaction.js";
import {
  DEFAULT_SESSION_NAME,
  appendSessionEntries,
  normalizeSessionName,
  normalizeSessionLabel,
  normalizeSessionLabels,
  normalizeSessionProject,
  sessionNameFromMessage,
  type SessionMetadata,
  type SessionStoreEntry
} from "./session-store.js";
import { getModelMemoryConfig, type ReasoningEffort } from "../provider/models.js";
import type { ChatMessage, LLMProvider, TokenUsage } from "../provider/types.js";

export interface TokenState {
  usedTokens: number;
  contextWindow: number;
  percent: number;
  warning: boolean;
  source: "estimate" | "provider";
  model: string;
  reserveTokens: number;
  keepRecentTokens: number;
  updatedAt: string;
}

export interface MaybeCompactOptions {
  provider: LLMProvider;
  model: string;
  reasoningEffort?: ReasoningEffort;
  systemPrompt: string;
  force?: boolean;
  signal?: AbortSignal;
}

export interface Session {
  readonly id: string;
  messages: ChatMessage[];
  metadata: SessionMetadata;
  append(msg: ChatMessage): void;
  renameConversation(name: string, project?: string | null): void;
  setProject(project: string | null): void;
  addLabel(label: string): boolean;
  removeLabel(label: string): boolean;
  setRunState(model: string, reasoningEffort?: ReasoningEffort): void;
  refreshTokenEstimate(model: string, systemPrompt?: string): TokenState;
  updateTokenUsage(model: string, usage: TokenUsage, systemPrompt?: string): TokenState;
  getTokenState(model?: string): TokenState;
  maybeCompact(options: MaybeCompactOptions): Promise<CompactionResult>;
  persist(): Promise<void>;
}

export interface CreateSessionOptions {
  id?: string;
  messages?: ChatMessage[];
  metadata?: Partial<SessionMetadata>;
  persisted?: boolean;
  model?: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function calculateTokenState(
  messages: ChatMessage[],
  model: string,
  systemPrompt: string,
  source: TokenState["source"],
  usedOverride?: number
): TokenState {
  const memory = getModelMemoryConfig(model);
  const usedTokens = Math.max(0, Math.round(usedOverride ?? estimateMessagesTokenCount(messages, systemPrompt)));
  const percent = memory.contextWindow > 0 ? (usedTokens / memory.contextWindow) * 100 : 0;
  return {
    usedTokens,
    contextWindow: memory.contextWindow,
    percent,
    warning: percent >= memory.warningPercent,
    source,
    model,
    reserveTokens: memory.reserveTokens,
    keepRecentTokens: memory.keepRecentTokens,
    updatedAt: nowIso()
  };
}

function usageToUsedTokens(usage: TokenUsage): number | undefined {
  if (usage.totalTokens !== undefined) {
    return usage.totalTokens;
  }

  if (usage.inputTokens !== undefined && usage.outputTokens !== undefined) {
    return usage.inputTokens + usage.outputTokens;
  }

  return usage.inputTokens ?? usage.outputTokens;
}

class MemorySession implements Session {
  readonly id: string;
  messages: ChatMessage[];
  metadata: SessionMetadata;
  private pendingEntries: SessionStoreEntry[] = [];
  private metaDirty: boolean;
  private tokenState: TokenState;
  private canAutoname: boolean;

  constructor(options: CreateSessionOptions = {}) {
    const createdAt = options.metadata?.createdAt ?? nowIso();
    const id = options.id ?? options.metadata?.id ?? randomUUID();
    const name = normalizeSessionName(options.metadata?.name ?? options.metadata?.title ?? DEFAULT_SESSION_NAME);
    this.id = id;
    this.messages = [...(options.messages ?? [])];
    this.metadata = {
      id,
      createdAt,
      updatedAt: options.metadata?.updatedAt ?? createdAt,
      model: options.metadata?.model ?? options.model,
      reasoningEffort: options.metadata?.reasoningEffort,
      project: normalizeSessionProject(options.metadata?.project),
      name,
      labels: normalizeSessionLabels(options.metadata?.labels),
      title: options.metadata?.title
    };
    this.metaDirty = !options.persisted;
    this.canAutoname = options.metadata?.name === undefined && options.metadata?.title === undefined;
    this.tokenState = calculateTokenState(this.messages, this.metadata.model ?? options.model ?? "gpt-5.5", "", "estimate");
  }

  append(msg: ChatMessage): void {
    this.messages.push(msg);
    const at = nowIso();
    this.pendingEntries.push({ type: "message", at, message: msg });
    this.metadata.updatedAt = at;

    if (this.canAutoname || !this.metadata.title) {
      const name = sessionNameFromMessage(msg);
      if (name) {
        if (this.canAutoname) {
          this.metadata.name = name;
          this.canAutoname = false;
        }
        if (!this.metadata.title) {
          this.metadata.title = name;
        }
        this.metaDirty = true;
      }
    }
  }

  renameConversation(name: string, project?: string | null): void {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error("Conversation name cannot be empty");
    }

    const nextName = normalizeSessionName(trimmedName);
    const nextProject = project === undefined ? this.metadata.project : normalizeSessionProject(project);
    if (this.metadata.name === nextName && this.metadata.project === nextProject) {
      this.canAutoname = false;
      return;
    }

    this.metadata.name = nextName;
    this.metadata.project = nextProject;
    this.metadata.title = nextName;
    this.metadata.updatedAt = nowIso();
    this.metaDirty = true;
    this.canAutoname = false;
  }

  setProject(project: string | null): void {
    const nextProject = normalizeSessionProject(project);
    if (this.metadata.project === nextProject) {
      return;
    }

    this.metadata.project = nextProject;
    this.metadata.updatedAt = nowIso();
    this.metaDirty = true;
  }

  addLabel(label: string): boolean {
    const nextLabel = normalizeSessionLabel(label);
    if (!nextLabel) {
      throw new Error("Conversation label cannot be empty");
    }

    if (this.metadata.labels.includes(nextLabel)) {
      return false;
    }

    this.metadata.labels = [...this.metadata.labels, nextLabel];
    this.metadata.updatedAt = nowIso();
    this.metaDirty = true;
    return true;
  }

  removeLabel(label: string): boolean {
    const targetLabel = normalizeSessionLabel(label);
    if (!targetLabel) {
      throw new Error("Conversation label cannot be empty");
    }

    const nextLabels = this.metadata.labels.filter((labelValue) => labelValue !== targetLabel);
    if (nextLabels.length === this.metadata.labels.length) {
      return false;
    }

    this.metadata.labels = nextLabels;
    this.metadata.updatedAt = nowIso();
    this.metaDirty = true;
    return true;
  }

  setRunState(model: string, reasoningEffort?: ReasoningEffort): void {
    if (this.metadata.model !== model || this.metadata.reasoningEffort !== reasoningEffort) {
      this.metadata.model = model;
      this.metadata.reasoningEffort = reasoningEffort;
      this.metadata.updatedAt = nowIso();
      this.metaDirty = true;
    }
  }

  refreshTokenEstimate(model: string, systemPrompt = ""): TokenState {
    this.tokenState = calculateTokenState(this.messages, model, systemPrompt, "estimate");
    return this.tokenState;
  }

  updateTokenUsage(model: string, usage: TokenUsage, systemPrompt = ""): TokenState {
    const used = usageToUsedTokens(usage);
    this.tokenState = calculateTokenState(this.messages, model, systemPrompt, used === undefined ? "estimate" : "provider", used);
    return this.tokenState;
  }

  getTokenState(model = this.metadata.model ?? this.tokenState.model): TokenState {
    if (model !== this.tokenState.model) {
      this.tokenState = calculateTokenState(this.messages, model, "", this.tokenState.source, this.tokenState.usedTokens);
    }
    return this.tokenState;
  }

  async maybeCompact(options: MaybeCompactOptions): Promise<CompactionResult> {
    this.setRunState(options.model, options.reasoningEffort);
    const before = this.refreshTokenEstimate(options.model, options.systemPrompt);
    const result = await compactMessages({
      messages: this.messages,
      provider: options.provider,
      model: options.model,
      reasoningEffort: options.reasoningEffort,
      systemPrompt: options.systemPrompt,
      usedTokens: before.usedTokens,
      force: options.force,
      signal: options.signal,
      sessionId: this.id
    });

    if (!result.compacted || !result.messages || !result.summary) {
      return result;
    }

    this.messages = result.messages;
    const at = nowIso();
    this.pendingEntries.push({
      type: "compaction",
      at,
      beforeTokens: result.beforeTokens,
      afterTokens: result.afterTokens,
      savedTokens: result.savedTokens,
      summary: result.summary,
      messages: this.messages
    });
    this.metadata.updatedAt = at;
    this.tokenState = calculateTokenState(this.messages, options.model, options.systemPrompt, "estimate", result.afterTokens);
    return result;
  }

  async persist(): Promise<void> {
    const entries = [...this.pendingEntries];
    this.pendingEntries = [];

    if (this.metaDirty) {
      this.metadata.updatedAt = this.metadata.updatedAt || nowIso();
      entries.unshift({ type: "meta", at: nowIso(), metadata: this.metadata });
      this.metaDirty = false;
    }

    if (entries.length === 0) {
      return;
    }

    try {
      await appendSessionEntries(this.id, entries);
    } catch (error) {
      this.pendingEntries.unshift(...entries);
      throw error;
    }
  }
}

export function createSession(options: CreateSessionOptions = {}): Session {
  return new MemorySession(options);
}
