import { randomUUID } from "node:crypto";
import type { ChatMessage } from "../provider/types.js";

export interface Session {
  readonly id: string;
  messages: ChatMessage[];
  append(msg: ChatMessage): void;
  maybeCompact(): Promise<void>;
  persist(): Promise<void>;
}

export function createSession(): Session {
  return {
    id: randomUUID(),
    messages: [],
    append(msg: ChatMessage) {
      this.messages.push(msg);
    },
    maybeCompact: async () => undefined,
    persist: async () => undefined
  };
}
