import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { z } from "zod";
import type { Tool } from "./types.js";
import { displayPath, resolveToolPath } from "./path-utils.js";

const writeSchema = z.object({
  path: z.string().min(1),
  content: z.string()
});

type WriteInput = z.infer<typeof writeSchema>;

function countLines(text: string): number {
  return text.length === 0 ? 0 : text.split(/\r\n|\r|\n/u).length;
}

export const writeTool: Tool<WriteInput> = {
  name: "write",
  description: "Create or overwrite a UTF-8 text file, creating parent directories when needed.",
  schema: writeSchema,
  jsonSchema: {
    type: "object",
    additionalProperties: false,
    required: ["path", "content"],
    properties: {
      path: { type: "string", description: "File path to write" },
      content: { type: "string", description: "Complete file content" }
    }
  },
  isReadOnly: false,
  activity: (input) => `Writing ${input.path}`,
  execute: async (input, ctx) => {
    const fullPath = resolveToolPath(ctx.cwd, input.path);
    const relPath = displayPath(ctx.cwd, fullPath);

    try {
      await mkdir(dirname(fullPath), { recursive: true });
      await writeFile(fullPath, input.content, "utf8");
      return { output: `Wrote ${countLines(input.content)} lines to ${relPath}` };
    } catch (error) {
      return {
        isError: true,
        output: `Cannot write ${relPath}: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
};
