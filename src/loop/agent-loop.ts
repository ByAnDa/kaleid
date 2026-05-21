import type { ChatMessage, ToolCall } from "../provider/types.js";
import { toToolSchemas } from "../tools/index.js";
import type { Tool, ToolResult } from "../tools/types.js";
import type { RunOptions, AgentEvent } from "./types.js";
import type { Session } from "./session.js";
import { buildSystemPrompt } from "./system-prompt.js";

const STEP_LIMIT = 50;

function schemaError(message: string): ToolResult {
  return { isError: true, output: message };
}

async function runTool(call: ToolCall, tool: Tool | undefined, opts: RunOptions): Promise<ToolResult> {
  if (!tool) {
    return { isError: true, output: `unknown tool: ${call.name}` };
  }

  const parsed = tool.schema.safeParse(call.arguments);
  if (!parsed.success) {
    return schemaError(parsed.error.issues.map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`).join("; "));
  }

  try {
    return await tool.execute(parsed.data, { cwd: opts.cwd, signal: opts.signal });
  } catch (error) {
    return {
      isError: true,
      output: error instanceof Error ? error.message : String(error)
    };
  }
}

export async function* runTurn(
  session: Session,
  userInput: string,
  opts: RunOptions
): AsyncIterable<AgentEvent> {
  session.append({ role: "user", content: userInput });

  try {
    await session.maybeCompact();

    for (let step = 0; step < STEP_LIMIT; step += 1) {
      if (opts.signal?.aborted) {
        yield { type: "error", message: "aborted" };
        return;
      }

      let assistantText = "";
      const toolCalls: ToolCall[] = [];

      const stream = opts.provider.chat({
        messages: session.messages,
        tools: toToolSchemas(opts.tools),
        model: opts.model,
        reasoningEffort: opts.reasoningEffort,
        systemPrompt: buildSystemPrompt(opts.cwd),
        signal: opts.signal,
        sessionId: session.id
      });

      for await (const event of stream) {
        if (event.type === "text") {
          assistantText += event.delta;
          yield { type: "assistant_text", delta: event.delta };
        } else if (event.type === "tool_call") {
          toolCalls.push(event.toolCall);
        }
      }

      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: assistantText,
        ...(toolCalls.length > 0 ? { toolCalls } : {})
      };
      session.append(assistantMessage);

      if (toolCalls.length === 0) {
        await session.persist();
        yield { type: "turn_done", final: assistantMessage };
        return;
      }

      for (const call of toolCalls) {
        const tool = opts.tools.find((candidate) => candidate.name === call.name);
        const activity = tool?.activity(call.arguments as never) ?? `Running unknown tool: ${call.name}`;
        yield { type: "tool_start", call, activity };
        const result = await runTool(call, tool, opts);
        yield { type: "tool_end", call, result };
        session.append({
          role: "tool",
          toolCallId: call.id,
          content: result.output
        });
      }
    }

    yield { type: "error", message: "step limit reached" };
  } catch (error) {
    if (opts.signal?.aborted) {
      yield { type: "error", message: "aborted" };
      return;
    }
    yield { type: "error", message: error instanceof Error ? error.message : String(error) };
  }
}
