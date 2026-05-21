import type { ReasoningEffort } from "./models.js";

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
}

export interface ToolSchema {
  name: string;
  description: string;
  parameters: object;
}

export interface TokenUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export type StreamEvent =
  | { type: "text"; delta: string }
  | { type: "tool_call"; toolCall: ToolCall }
  | { type: "usage"; usage: TokenUsage }
  | { type: "done"; finishReason: "stop" | "tool_calls" | "length" };

export interface ChatParams {
  messages: ChatMessage[];
  tools: ToolSchema[];
  model: string;
  reasoningEffort?: ReasoningEffort;
  systemPrompt: string;
  signal?: AbortSignal;
  sessionId?: string;
}

export interface LLMProvider {
  readonly id: string;
  chat(params: ChatParams): AsyncIterable<StreamEvent>;
}
