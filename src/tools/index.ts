import type { ToolSchema } from "../provider/types.js";
import { bashTool } from "./bash.js";
import { editTool } from "./edit.js";
import { readTool } from "./read.js";
import type { Tool } from "./types.js";
import { writeTool } from "./write.js";

export const tools: Tool[] = [readTool, writeTool, editTool, bashTool];

export function toToolSchemas(toolList: Tool[] = tools): ToolSchema[] {
  return toolList.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.jsonSchema
  }));
}

export { bashTool, editTool, readTool, writeTool };
export type { Tool, ToolContext, ToolResult } from "./types.js";
