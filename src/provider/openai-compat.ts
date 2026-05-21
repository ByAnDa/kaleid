import type { ChatMessage, ChatParams, LLMProvider, StreamEvent, TokenUsage, ToolCall, ToolSchema } from "./types.js";
import type { ApiKeyProviderId } from "../auth/config-store.js";

interface PendingToolCall {
  id: string;
  index: number;
  name: string;
  argumentsText: string;
}

interface ChatCompletionMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

export interface OpenAICompatProviderOptions {
  id: ApiKeyProviderId;
  baseURL: string;
  apiKey: string;
  defaultModel: string;
  fetchImpl?: typeof fetch;
}

function cleanBaseURL(baseURL: string): string {
  return baseURL.replace(/\/+$/u, "");
}

function parseArguments(text: string): Record<string, unknown> {
  if (text.trim().length === 0) {
    return {};
  }

  const parsed = JSON.parse(text) as unknown;
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    return parsed as Record<string, unknown>;
  }

  throw new Error("Function call arguments must be a JSON object");
}

function finishReason(value: unknown, usedTool: boolean): "stop" | "tool_calls" | "length" {
  if (value === "length") {
    return "length";
  }

  if (value === "tool_calls" || usedTool) {
    return "tool_calls";
  }

  return "stop";
}

export function encodeChatMessages(systemPrompt: string, messages: ChatMessage[]): ChatCompletionMessage[] {
  const encoded: ChatCompletionMessage[] = [{ role: "system", content: systemPrompt }];

  for (const message of messages) {
    if (message.role === "tool") {
      if (!message.toolCallId) {
        continue;
      }
      encoded.push({
        role: "tool",
        tool_call_id: message.toolCallId,
        content: message.content
      });
      continue;
    }

    encoded.push({
      role: message.role,
      content: message.content.length > 0 ? message.content : null,
      ...(message.toolCalls && message.toolCalls.length > 0
        ? {
            tool_calls: message.toolCalls.map((toolCall) => ({
              id: toolCall.id,
              type: "function" as const,
              function: {
                name: toolCall.name,
                arguments: JSON.stringify(toolCall.arguments)
              }
            }))
          }
        : {})
    });
  }

  return encoded;
}

export function encodeChatTools(tools: ToolSchema[]): Array<{
  type: "function";
  function: { name: string; description: string; parameters: object };
}> {
  return tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }
  }));
}

export function buildChatCompletionBody(params: ChatParams): Record<string, unknown> {
  const tools = encodeChatTools(params.tools);
  return {
    model: params.model,
    messages: encodeChatMessages(params.systemPrompt, params.messages),
    stream: true,
    stream_options: { include_usage: true },
    ...(tools.length > 0
      ? {
          tools,
          tool_choice: "auto"
        }
      : {})
  };
}

function toolKey(choiceIndex: number, raw: Record<string, unknown>, pending: Map<string, PendingToolCall>): string {
  if (typeof raw.id === "string" && raw.id.length > 0) {
    return raw.id;
  }

  if (typeof raw.index === "number") {
    const existing = [...pending.entries()].find(([, call]) => call.index === raw.index);
    if (existing) {
      return existing[0];
    }
    return `${choiceIndex}:${raw.index}`;
  }

  return `${choiceIndex}:0`;
}

function pendingToToolCalls(pending: Map<string, PendingToolCall>): ToolCall[] {
  const calls = [...pending.values()].sort((a, b) => a.index - b.index);
  pending.clear();
  return calls.map((call) => ({
    id: call.id,
    name: call.name,
    arguments: parseArguments(call.argumentsText)
  }));
}

function numberField(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function parseUsage(value: unknown): TokenUsage | null {
  const usage = value as Record<string, unknown> | undefined;
  if (!usage || typeof usage !== "object") {
    return null;
  }

  const parsed: TokenUsage = {
    inputTokens: numberField(usage.prompt_tokens ?? usage.input_tokens),
    outputTokens: numberField(usage.completion_tokens ?? usage.output_tokens),
    totalTokens: numberField(usage.total_tokens)
  };

  return parsed.inputTokens !== undefined || parsed.outputTokens !== undefined || parsed.totalTokens !== undefined
    ? parsed
    : null;
}

function processChunkData(
  data: string,
  pending: Map<string, PendingToolCall>
): { events: StreamEvent[]; usedTool: boolean; done: boolean } {
  if (data === "[DONE]") {
    const calls = pendingToToolCalls(pending);
    return {
      events: calls.map((toolCall) => ({ type: "tool_call", toolCall })),
      usedTool: calls.length > 0,
      done: true
    };
  }

  const payload = JSON.parse(data) as Record<string, unknown>;
  const choices = Array.isArray(payload.choices) ? (payload.choices as Record<string, unknown>[]) : [];
  const events: StreamEvent[] = [];
  let usedTool = false;
  let done = false;

  const usage = parseUsage(payload.usage);
  if (usage) {
    events.push({ type: "usage", usage });
  }

  for (let choiceIndex = 0; choiceIndex < choices.length; choiceIndex += 1) {
    const choice = choices[choiceIndex];
    if (!choice) {
      continue;
    }

    const delta = choice.delta as Record<string, unknown> | undefined;
    if (typeof delta?.content === "string" && delta.content.length > 0) {
      events.push({ type: "text", delta: delta.content });
    }

    const rawToolCalls = Array.isArray(delta?.tool_calls)
      ? (delta.tool_calls as Record<string, unknown>[])
      : [];
    for (const rawToolCall of rawToolCalls) {
      const key = toolKey(choiceIndex, rawToolCall, pending);
      const fn = rawToolCall.function as Record<string, unknown> | undefined;
      const existing = pending.get(key);
      const id = typeof rawToolCall.id === "string" && rawToolCall.id ? rawToolCall.id : existing?.id ?? key;
      const index = typeof rawToolCall.index === "number" ? rawToolCall.index : existing?.index ?? pending.size;
      pending.set(key, {
        id,
        index,
        name:
          typeof fn?.name === "string" && fn.name.length > 0
            ? fn.name
            : existing?.name ?? "",
        argumentsText: `${existing?.argumentsText ?? ""}${typeof fn?.arguments === "string" ? fn.arguments : ""}`
      });
    }

    if (choice.finish_reason) {
      const calls = pendingToToolCalls(pending);
      for (const toolCall of calls) {
        events.push({ type: "tool_call", toolCall });
      }
      usedTool = calls.length > 0;
      events.push({ type: "done", finishReason: finishReason(choice.finish_reason, usedTool) });
      done = true;
    }
  }

  return { events, usedTool, done };
}

async function* chunksToFrames(body: ReadableStream<Uint8Array>): AsyncIterable<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      while (true) {
        const separatorIndex = buffer.search(/\r?\n\r?\n/u);
        if (separatorIndex < 0) {
          break;
        }
        const frame = buffer.slice(0, separatorIndex);
        const match = buffer.slice(separatorIndex).match(/^\r?\n\r?\n/u);
        buffer = buffer.slice(separatorIndex + (match?.[0].length ?? 2));
        yield frame;
      }
    }

    buffer += decoder.decode();
    if (buffer.trim().length > 0) {
      yield buffer;
    }
  } finally {
    reader.releaseLock();
  }
}

export async function* parseChatCompletionsSSE(body: ReadableStream<Uint8Array>): AsyncIterable<StreamEvent> {
  const pending = new Map<string, PendingToolCall>();
  let usedTool = false;
  let doneEmitted = false;

  for await (const frame of chunksToFrames(body)) {
    const dataLines = frame
      .split(/\r?\n/u)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice("data:".length).trimStart());

    for (const data of dataLines) {
      const result = processChunkData(data, pending);
      usedTool = usedTool || result.usedTool;

      for (const event of result.events) {
        if (event.type === "done") {
          doneEmitted = true;
        }
        yield event;
      }
    }
  }

  if (pending.size > 0) {
    usedTool = true;
    for (const toolCall of pendingToToolCalls(pending)) {
      yield { type: "tool_call", toolCall };
    }
  }

  if (!doneEmitted) {
    yield { type: "done", finishReason: usedTool ? "tool_calls" : "stop" };
  }
}

export class OpenAICompatProvider implements LLMProvider {
  readonly id: ApiKeyProviderId;
  private readonly apiKey: string;
  private readonly baseURL: string;
  private readonly defaultModel: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: OpenAICompatProviderOptions) {
    this.id = options.id;
    this.apiKey = options.apiKey;
    this.baseURL = cleanBaseURL(options.baseURL);
    this.defaultModel = options.defaultModel;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async *chat(params: ChatParams): AsyncIterable<StreamEvent> {
    const response = await this.fetchImpl(`${this.baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: "text/event-stream",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(
        buildChatCompletionBody({
          ...params,
          model: params.model || this.defaultModel
        })
      ),
      signal: params.signal
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`${this.id} request failed (${response.status}): ${text || response.statusText}`);
    }

    if (!response.body) {
      throw new Error(`${this.id} response did not include a stream body`);
    }

    yield* parseChatCompletionsSSE(response.body);
  }
}
