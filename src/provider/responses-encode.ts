import type { ChatMessage, ChatParams, ToolSchema } from "./types.js";
import { DEFAULT_REASONING_EFFORT, type ReasoningEffort } from "./models.js";

type ResponsesInputItem =
  | {
      type: "message";
      role: "user" | "assistant" | "system";
      content: Array<{ type: "input_text" | "output_text"; text: string }>;
    }
  | {
      type: "function_call";
      call_id: string;
      name: string;
      arguments: string;
    }
  | {
      type: "function_call_output";
      call_id: string;
      output: string;
    };

export interface ResponsesRequestBody {
  model: string;
  store: false;
  stream: true;
  instructions: string;
  input: ResponsesInputItem[];
  reasoning: { effort: ReasoningEffort };
  text: { verbosity: "low" };
  include: string[];
  prompt_cache_key?: string;
  tool_choice: "auto";
  parallel_tool_calls: true;
  tools: Array<{
    type: "function";
    name: string;
    description: string;
    parameters: object;
    strict: false;
  }>;
}

export function encodeMessages(messages: ChatMessage[]): ResponsesInputItem[] {
  const items: ResponsesInputItem[] = [];

  for (const message of messages) {
    if (message.role === "tool") {
      if (!message.toolCallId) {
        continue;
      }
      items.push({
        type: "function_call_output",
        call_id: message.toolCallId,
        output: message.content
      });
      continue;
    }

    if (message.content.length > 0) {
      items.push({
        type: "message",
        role: message.role,
        content: [
          {
            type: message.role === "assistant" ? "output_text" : "input_text",
            text: message.content
          }
        ]
      });
    }

    for (const toolCall of message.toolCalls ?? []) {
      items.push({
        type: "function_call",
        call_id: toolCall.id,
        name: toolCall.name,
        arguments: JSON.stringify(toolCall.arguments)
      });
    }
  }

  return items;
}

export function encodeTools(tools: ToolSchema[]): ResponsesRequestBody["tools"] {
  return tools.map((tool) => ({
    type: "function",
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
    strict: false
  }));
}

export function buildRequestBody(params: ChatParams): ResponsesRequestBody {
  return {
    model: params.model,
    store: false,
    stream: true,
    instructions: params.systemPrompt,
    input: encodeMessages(params.messages),
    reasoning: { effort: params.reasoningEffort ?? DEFAULT_REASONING_EFFORT },
    text: { verbosity: "low" },
    include: ["reasoning.encrypted_content"],
    ...(params.sessionId ? { prompt_cache_key: params.sessionId } : {}),
    tool_choice: "auto",
    parallel_tool_calls: true,
    tools: encodeTools(params.tools)
  };
}
