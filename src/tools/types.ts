import type { z } from "zod";

export interface ToolResult {
  output: string;
  isError?: boolean;
}

export interface ToolContext {
  cwd: string;
  signal?: AbortSignal;
}

export interface Tool<I = unknown> {
  readonly name: "read" | "write" | "edit" | "bash";
  readonly description: string;
  readonly schema: z.ZodType<I>;
  readonly jsonSchema: object;
  readonly isReadOnly: boolean;
  activity(input: I): string;
  execute(input: I, ctx: ToolContext): Promise<ToolResult>;
}
