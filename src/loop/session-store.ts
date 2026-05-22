import { appendFile, mkdir, readdir, readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ReasoningEffort } from "../provider/models.js";
import type { ChatMessage } from "../provider/types.js";

export type ResumeRequest = { kind: "latest" } | { kind: "select" } | { kind: "id"; id: string };

export interface SessionMetadata {
  id: string;
  createdAt: string;
  updatedAt: string;
  model?: string;
  reasoningEffort?: ReasoningEffort;
  project: string | null;
  name: string;
  title?: string;
}

export type SessionStoreEntry =
  | { type: "meta"; at: string; metadata: SessionMetadata }
  | { type: "message"; at: string; message: ChatMessage }
  | {
      type: "compaction";
      at: string;
      beforeTokens: number;
      afterTokens: number;
      savedTokens: number;
      summary: string;
      messages: ChatMessage[];
    };

export interface SessionData {
  id: string;
  metadata: SessionMetadata;
  messages: ChatMessage[];
}

export interface SessionSummary {
  id: string;
  title: string;
  project: string | null;
  name: string;
  label: string;
  createdAt: string;
  updatedAt: string;
  model?: string;
  reasoningEffort?: ReasoningEffort;
  messageCount: number;
}

export const DEFAULT_SESSION_NAME = "untitled";

export function getSessionDir(): string {
  return process.env.KALEID_SESSIONS_DIR ?? join(homedir(), ".kaleid", "sessions");
}

function assertSessionId(id: string): void {
  if (!/^[A-Za-z0-9_.-]+$/u.test(id)) {
    throw new Error(`Invalid session id: ${id}`);
  }
}

function sessionPath(id: string): string {
  assertSessionId(id);
  return join(getSessionDir(), `${id}.jsonl`);
}

function safeJsonParse(line: string): SessionStoreEntry | null {
  try {
    const parsed = JSON.parse(line) as unknown;
    if (parsed && typeof parsed === "object" && "type" in parsed) {
      return parsed as SessionStoreEntry;
    }
  } catch {
    return null;
  }
  return null;
}

export function normalizeSessionProject(project: string | null | undefined): string | null {
  const trimmed = project?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeSessionName(name: string | null | undefined): string {
  const trimmed = name?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : DEFAULT_SESSION_NAME;
}

export function sessionNameFromMessage(message: ChatMessage): string | undefined {
  if (message.role !== "user") {
    return undefined;
  }

  const firstLine = message.content.split(/\r?\n/u)[0] ?? "";
  const name = firstLine.trim().replace(/\s+/gu, " ").slice(0, 80);
  return name.length > 0 ? name : undefined;
}

function deriveSessionName(metadata: Partial<SessionMetadata>, messages: ChatMessage[]): string {
  const metadataName = metadata.name ?? metadata.title;
  if (metadataName && metadataName.trim().length > 0) {
    return normalizeSessionName(metadataName);
  }

  for (const message of messages) {
    const name = sessionNameFromMessage(message);
    if (name) {
      return name;
    }
  }

  return DEFAULT_SESSION_NAME;
}

export function formatSessionDisplayName(project: string | null | undefined, name: string): string {
  const normalizedProject = normalizeSessionProject(project);
  const normalizedName = normalizeSessionName(name);
  return normalizedProject ? `${normalizedProject} - ${normalizedName}` : normalizedName;
}

export async function appendSessionEntries(id: string, entries: SessionStoreEntry[]): Promise<void> {
  if (entries.length === 0) {
    return;
  }

  await mkdir(getSessionDir(), { recursive: true, mode: 0o700 });
  const data = entries.map((entry) => JSON.stringify(entry)).join("\n") + "\n";
  await appendFile(sessionPath(id), data, { encoding: "utf8", mode: 0o600 });
}

export async function loadSessionData(id: string): Promise<SessionData> {
  const file = sessionPath(id);
  const text = await readFile(file, "utf8");
  const now = new Date().toISOString();
  let metadata: SessionMetadata = {
    id,
    createdAt: now,
    updatedAt: now,
    project: null,
    name: DEFAULT_SESSION_NAME
  };
  let messages: ChatMessage[] = [];
  let sawStoredName = false;

  for (const line of text.split(/\r?\n/u)) {
    if (line.trim().length === 0) {
      continue;
    }

    const entry = safeJsonParse(line);
    if (!entry) {
      continue;
    }

    if (entry.type === "meta") {
      if (Object.prototype.hasOwnProperty.call(entry.metadata, "name")) {
        sawStoredName = true;
      }
      metadata = { ...metadata, ...entry.metadata, id };
      continue;
    }

    if (entry.type === "message") {
      messages.push(entry.message);
      metadata.updatedAt = entry.at;
      continue;
    }

    if (entry.type === "compaction") {
      messages = entry.messages;
      metadata.updatedAt = entry.at;
    }
  }

  metadata.project = normalizeSessionProject(metadata.project);
  metadata.name = deriveSessionName(sawStoredName ? metadata : { ...metadata, name: undefined }, messages);

  return { id, metadata, messages };
}

export async function listSessions(): Promise<SessionSummary[]> {
  await mkdir(getSessionDir(), { recursive: true, mode: 0o700 });
  const files = await readdir(getSessionDir());
  const summaries: SessionSummary[] = [];

  for (const file of files) {
    if (!file.endsWith(".jsonl")) {
      continue;
    }

    const id = file.slice(0, -".jsonl".length);
    try {
      const data = await loadSessionData(id);
      const fileStat = await stat(sessionPath(id));
      const updatedAt = data.metadata.updatedAt || fileStat.mtime.toISOString();
      const label = formatSessionDisplayName(data.metadata.project, data.metadata.name);
      summaries.push({
        id,
        title: label,
        project: data.metadata.project,
        name: data.metadata.name,
        label,
        createdAt: data.metadata.createdAt,
        updatedAt,
        model: data.metadata.model,
        reasoningEffort: data.metadata.reasoningEffort,
        messageCount: data.messages.length
      });
    } catch {
      continue;
    }
  }

  return summaries.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

export async function loadLatestSession(): Promise<SessionData | null> {
  const [latest] = await listSessions();
  return latest ? loadSessionData(latest.id) : null;
}
