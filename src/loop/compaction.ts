import type { ReasoningEffort } from "../provider/models.js";
import type { ChatMessage, LLMProvider } from "../provider/types.js";
import { getModelMemoryConfig } from "../provider/models.js";

export const COMPACTION_SUMMARY_PREFIX = "[compaction-summary]";

export const COMPACTION_SYSTEM_PROMPT = `You compact an active coding-agent conversation.
Return a concise but complete summary that preserves:
- the user's goal and constraints
- important decisions and assumptions
- files changed or inspected
- tool results that matter
- unfinished work and next steps
Do not include generic filler.`;

export interface CompactionResult {
  compacted: boolean;
  beforeTokens: number;
  afterTokens: number;
  savedTokens: number;
  summary?: string;
  reason?: string;
  messages?: ChatMessage[];
}

export interface CompactMessagesOptions {
  messages: ChatMessage[];
  provider: LLMProvider;
  model: string;
  reasoningEffort?: ReasoningEffort;
  systemPrompt: string;
  usedTokens?: number;
  force?: boolean;
  signal?: AbortSignal;
  sessionId?: string;
}

interface MessageGroup {
  messages: ChatMessage[];
  tokens: number;
}

export function estimateTextTokens(text: string): number {
  if (text.length === 0) {
    return 0;
  }

  let ascii = 0;
  let nonAscii = 0;
  for (const char of text) {
    if (char.charCodeAt(0) <= 0x7f) {
      ascii += 1;
    } else {
      nonAscii += 1;
    }
  }

  return Math.max(1, Math.ceil(ascii / 4 + nonAscii / 2));
}

export function estimateMessageTokens(message: ChatMessage): number {
  const toolCalls = message.toolCalls && message.toolCalls.length > 0 ? JSON.stringify(message.toolCalls) : "";
  const toolCallId = message.toolCallId ?? "";
  const reasoningContent = message.reasoningContent ?? "";
  return 4 + estimateTextTokens(message.role) + estimateTextTokens(message.content) + estimateTextTokens(reasoningContent) + estimateTextTokens(toolCalls) + estimateTextTokens(toolCallId);
}

export function estimateMessagesTokenCount(messages: ChatMessage[], systemPrompt = ""): number {
  const systemTokens = estimateTextTokens(systemPrompt);
  const messageTokens = messages.reduce((total, message) => total + estimateMessageTokens(message), 0);
  return systemTokens + messageTokens;
}

function groupMessages(messages: ChatMessage[]): MessageGroup[] {
  const groups: MessageGroup[] = [];
  let current: ChatMessage[] = [];

  for (const message of messages) {
    if (message.role === "user" && current.length > 0) {
      groups.push({
        messages: current,
        tokens: estimateMessagesTokenCount(current)
      });
      current = [];
    }
    current.push(message);
  }

  if (current.length > 0) {
    groups.push({
      messages: current,
      tokens: estimateMessagesTokenCount(current)
    });
  }

  return groups;
}

function chooseCompactionSplit(messages: ChatMessage[], keepRecentTokens: number): { oldMessages: ChatMessage[]; recentMessages: ChatMessage[] } | null {
  const groups = groupMessages(messages);
  if (groups.length < 2) {
    return null;
  }

  let keepStart = groups.length - 1;
  let keptTokens = 0;
  for (let index = groups.length - 1; index >= 0; index -= 1) {
    const group = groups[index];
    if (!group) {
      continue;
    }

    if (keptTokens > 0 && keptTokens + group.tokens > keepRecentTokens) {
      break;
    }

    keptTokens += group.tokens;
    keepStart = index;
  }

  if (keepStart <= 0) {
    keepStart = 1;
  }

  const oldMessages = groups.slice(0, keepStart).flatMap((group) => group.messages);
  const recentMessages = groups.slice(keepStart).flatMap((group) => group.messages);
  return oldMessages.length > 0 && recentMessages.length > 0 ? { oldMessages, recentMessages } : null;
}

function formatMessageForSummary(message: ChatMessage): string {
  const toolCalls =
    message.toolCalls && message.toolCalls.length > 0
      ? `\n  tool_calls: ${JSON.stringify(message.toolCalls)}`
      : "";
  const toolCallId = message.toolCallId ? ` tool_call_id=${message.toolCallId}` : "";
  return `<${message.role}${toolCallId}>\n${message.content}${toolCalls}\n</${message.role}>`;
}

function buildCompactionPrompt(messages: ChatMessage[]): string {
  return `Summarize the older portion of this conversation for future context. Preserve concrete facts, not style.\n\n${messages
    .map(formatMessageForSummary)
    .join("\n\n")}`;
}

async function collectSummary(
  provider: LLMProvider,
  options: Omit<CompactMessagesOptions, "messages" | "usedTokens" | "force" | "provider">,
  messages: ChatMessage[]
): Promise<string> {
  let summary = "";
  const stream = provider.chat({
    messages: [{ role: "user", content: buildCompactionPrompt(messages) }],
    tools: [],
    model: options.model,
    reasoningEffort: options.reasoningEffort,
    systemPrompt: COMPACTION_SYSTEM_PROMPT,
    signal: options.signal,
    sessionId: options.sessionId ? `${options.sessionId}:compact` : undefined
  });

  for await (const event of stream) {
    if (event.type === "text") {
      summary += event.delta;
    }
  }

  const trimmed = summary.trim();
  return trimmed.length > 0 ? trimmed : "Earlier conversation was compacted, but the summarizer returned an empty summary.";
}

export function makeCompactionSummaryMessage(summary: string): ChatMessage {
  return {
    role: "user",
    content: `${COMPACTION_SUMMARY_PREFIX}\n${summary.trim()}`
  };
}

export async function compactMessages(options: CompactMessagesOptions): Promise<CompactionResult> {
  const memory = getModelMemoryConfig(options.model);
  const beforeTokens = options.usedTokens ?? estimateMessagesTokenCount(options.messages, options.systemPrompt);
  const shouldCompact = options.force || beforeTokens > memory.contextWindow - memory.reserveTokens;

  if (!shouldCompact) {
    return {
      compacted: false,
      beforeTokens,
      afterTokens: beforeTokens,
      savedTokens: 0,
      reason: "below-threshold"
    };
  }

  const split = chooseCompactionSplit(options.messages, memory.keepRecentTokens);
  if (!split) {
    return {
      compacted: false,
      beforeTokens,
      afterTokens: beforeTokens,
      savedTokens: 0,
      reason: "not-enough-history"
    };
  }

  const summary = await collectSummary(options.provider, options, split.oldMessages);
  const nextMessages = [makeCompactionSummaryMessage(summary), ...split.recentMessages];
  const afterTokens = estimateMessagesTokenCount(nextMessages, options.systemPrompt);

  return {
    compacted: true,
    beforeTokens,
    afterTokens,
    savedTokens: Math.max(0, beforeTokens - afterTokens),
    summary,
    messages: nextMessages
  };
}
