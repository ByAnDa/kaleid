import type { StreamEvent, ToolCall } from "./types.js";

interface PendingToolCall {
  id: string;
  name: string;
  argumentsText: string;
}

function parseFinishReason(value: unknown, usedTool: boolean): "stop" | "tool_calls" | "length" {
  if (value === "length" || value === "max_output_tokens") {
    return "length";
  }
  return usedTool ? "tool_calls" : "stop";
}

function eventKey(event: Record<string, unknown>): string | undefined {
  const item = event.item as Record<string, unknown> | undefined;
  return (
    (typeof event.call_id === "string" && event.call_id) ||
    (typeof event.item_id === "string" && event.item_id) ||
    (typeof item?.call_id === "string" && item.call_id) ||
    (typeof item?.id === "string" && item.id) ||
    (typeof event.output_index === "number" ? String(event.output_index) : undefined)
  );
}

function firstPending(pending: Map<string, PendingToolCall>): PendingToolCall | undefined {
  return pending.values().next().value as PendingToolCall | undefined;
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

function processDataLine(
  data: string,
  pending: Map<string, PendingToolCall>,
  markToolUsed: () => void
): StreamEvent[] {
  if (data === "[DONE]") {
    return [];
  }

  const event = JSON.parse(data) as Record<string, unknown>;
  const type = event.type;

  if (type === "response.output_text.delta") {
    return typeof event.delta === "string" ? [{ type: "text", delta: event.delta }] : [];
  }

  if (type === "response.output_item.added") {
    const item = event.item as Record<string, unknown> | undefined;
    if (item?.type === "function_call") {
      const id = String(item.call_id ?? item.id ?? event.output_index ?? crypto.randomUUID());
      pending.set(id, {
        id,
        name: typeof item.name === "string" ? item.name : "",
        argumentsText: typeof item.arguments === "string" ? item.arguments : ""
      });
    }
    return [];
  }

  if (type === "response.function_call_arguments.delta") {
    const key = eventKey(event);
    const call = (key ? pending.get(key) : undefined) ?? firstPending(pending);
    if (call && typeof event.delta === "string") {
      call.argumentsText += event.delta;
    }
    return [];
  }

  if (type === "response.output_item.done") {
    const item = event.item as Record<string, unknown> | undefined;
    if (item?.type !== "function_call") {
      return [];
    }

    const key = eventKey(event);
    const stored = key ? pending.get(key) : undefined;
    const id = String(item.call_id ?? stored?.id ?? item.id ?? key ?? crypto.randomUUID());
    const name = String(item.name ?? stored?.name ?? "");
    const argumentsText = String(item.arguments ?? stored?.argumentsText ?? "");
    if (key) {
      pending.delete(key);
    }
    markToolUsed();
    return [
      {
        type: "tool_call",
        toolCall: {
          id,
          name,
          arguments: parseArguments(argumentsText)
        }
      }
    ];
  }

  if (type === "response.failed" || type === "response.incomplete") {
    const error = event.error as Record<string, unknown> | undefined;
    const message =
      typeof error?.message === "string"
        ? error.message
        : typeof event.reason === "string"
          ? event.reason
          : `OpenAI response ${String(type).replace("response.", "")}`;
    throw new Error(message);
  }

  if (type === "response.completed" || type === "response.done") {
    const response = event.response as Record<string, unknown> | undefined;
    const finishReason = parseFinishReason(response?.finish_reason ?? event.finish_reason, pending.size > 0);
    return [{ type: "done", finishReason }];
  }

  return [];
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

export async function* parseResponsesSSE(body: ReadableStream<Uint8Array>): AsyncIterable<StreamEvent> {
  const pending = new Map<string, PendingToolCall>();
  let usedTool = false;
  let doneEmitted = false;

  for await (const frame of chunksToFrames(body)) {
    const dataLines = frame
      .split(/\r?\n/u)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice("data:".length).trimStart());

    for (const data of dataLines) {
      const events = processDataLine(data, pending, () => {
        usedTool = true;
      });

      for (const event of events) {
        if (event.type === "done") {
          doneEmitted = true;
          yield { ...event, finishReason: parseFinishReason(event.finishReason, usedTool) };
        } else {
          yield event;
        }
      }
    }
  }

  if (!doneEmitted) {
    yield { type: "done", finishReason: usedTool ? "tool_calls" : "stop" };
  }
}
