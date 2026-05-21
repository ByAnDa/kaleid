import type { ToolCall } from "../provider/types.js";
import type { Tool, ToolResult } from "../tools/types.js";
import type { LLMProvider } from "../provider/types.js";
import type { ReasoningEffort } from "../provider/models.js";
import type { CompactionResult } from "./compaction.js";
import type { TokenState } from "./session.js";

export type AgentEvent =
  | { type: "assistant_text"; delta: string }
  | { type: "tool_start"; call: ToolCall; activity: string }
  | { type: "tool_end"; call: ToolCall; result: ToolResult }
  | { type: "token_update"; state: TokenState }
  | { type: "compaction"; result: CompactionResult }
  | { type: "turn_done"; final: import("../provider/types.js").ChatMessage }
  | { type: "error"; message: string };

export interface RunOptions {
  provider: LLMProvider;
  tools: Tool[];
  model: string;
  reasoningEffort?: ReasoningEffort;
  cwd: string;
  signal?: AbortSignal;
}
