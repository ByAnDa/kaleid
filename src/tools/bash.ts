import { z } from "zod";
import { executeBash } from "./bash-executor.js";
import type { Tool } from "./types.js";

const bashSchema = z.object({
  command: z.string().min(1),
  timeout: z.number().positive().optional()
});

type BashInput = z.infer<typeof bashSchema>;

export const bashTool: Tool<BashInput> = {
  name: "bash",
  description: "Run a shell command through bash -lc in the current workspace.",
  schema: bashSchema,
  jsonSchema: {
    type: "object",
    additionalProperties: false,
    required: ["command"],
    properties: {
      command: { type: "string", description: "Command to run" },
      timeout: { type: "number", exclusiveMinimum: 0, description: "Optional timeout in seconds" }
    }
  },
  isReadOnly: false,
  activity: (input) => `Running: ${input.command.slice(0, 60)}`,
  execute: async (input, ctx) => {
    try {
      const result = await executeBash(input.command, {
        cwd: ctx.cwd,
        signal: ctx.signal,
        timeoutSec: input.timeout
      });
      const cancelled = result.cancelled ? "\n[cancelled]" : "";
      return {
        output: `${result.output}${result.output.endsWith("\n") || result.output.length === 0 ? "" : "\n"}${cancelled}\n[exit code: ${result.exitCode ?? "unknown"}]`
      };
    } catch (error) {
      return {
        isError: true,
        output: `Command failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
};
