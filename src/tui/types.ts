import type { ToolCallView } from "./components/ToolCall.js";

export interface Msg {
  id: string;
  role: "user" | "assistant" | "tool" | "error" | "system";
  text: string;
  tool?: ToolCallView;
}
