import { readFile, writeFile } from "node:fs/promises";
import { z } from "zod";
import type { Tool } from "./types.js";
import { displayPath, resolveToolPath } from "./path-utils.js";

const editSchema = z.object({
  path: z.string().min(1),
  old_string: z.string().min(1),
  new_string: z.string()
});

type EditInput = z.infer<typeof editSchema>;

function countOccurrences(text: string, needle: string): number {
  if (needle.length === 0) {
    return 0;
  }
  return text.split(needle).length - 1;
}

function changedLineIndex(before: string, after: string): number {
  const beforeLines = before.split(/\r?\n/u);
  const afterLines = after.split(/\r?\n/u);
  const max = Math.max(beforeLines.length, afterLines.length);
  for (let i = 0; i < max; i += 1) {
    if (beforeLines[i] !== afterLines[i]) {
      return i;
    }
  }
  return 0;
}

function diffSummary(path: string, before: string, after: string): string {
  const lines = after.split(/\r?\n/u);
  const changed = changedLineIndex(before, after);
  const start = Math.max(0, changed - 3);
  const end = Math.min(lines.length, changed + 4);
  const width = String(end).length;
  const context = lines
    .slice(start, end)
    .map((line, index) => `${String(start + index + 1).padStart(width, " ")}\t${line}`)
    .join("\n");

  return `Edited ${path}\n${context}`;
}

export const editTool: Tool<EditInput> = {
  name: "edit",
  description: "Replace one exact unique string in a UTF-8 text file.",
  schema: editSchema,
  jsonSchema: {
    type: "object",
    additionalProperties: false,
    required: ["path", "old_string", "new_string"],
    properties: {
      path: { type: "string", description: "File path to edit" },
      old_string: { type: "string", minLength: 1, description: "Exact text to replace; must be unique" },
      new_string: { type: "string", description: "Replacement text" }
    }
  },
  isReadOnly: false,
  activity: (input) => `Editing ${input.path}`,
  execute: async (input, ctx) => {
    const fullPath = resolveToolPath(ctx.cwd, input.path);
    const relPath = displayPath(ctx.cwd, fullPath);

    if (input.old_string === input.new_string) {
      return { isError: true, output: "old_string and new_string must be different" };
    }

    try {
      const before = await readFile(fullPath, "utf8");
      const occurrences = countOccurrences(before, input.old_string);
      if (occurrences === 0) {
        return { isError: true, output: "old_string not found" };
      }
      if (occurrences > 1) {
        return {
          isError: true,
          output: `old_string appears ${occurrences} times, must be unique - add surrounding context`
        };
      }

      const after = before.replace(input.old_string, input.new_string);
      await writeFile(fullPath, after, "utf8");
      return { output: diffSummary(relPath, before, after) };
    } catch (error) {
      return {
        isError: true,
        output: `Cannot edit ${relPath}: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
};
