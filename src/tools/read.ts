import { readFile, stat } from "node:fs/promises";
import { TextDecoder } from "node:util";
import { z } from "zod";
import { DEFAULT_MAX_BYTES, DEFAULT_MAX_LINES, truncateHead } from "./truncate.js";
import type { Tool } from "./types.js";
import { displayPath, resolveToolPath } from "./path-utils.js";

const readSchema = z.object({
  path: z.string().min(1),
  offset: z.number().int().positive().optional(),
  limit: z.number().int().positive().optional()
});

type ReadInput = z.infer<typeof readSchema>;

function hasNulByte(buffer: Buffer): boolean {
  return buffer.subarray(0, Math.min(buffer.length, 8000)).includes(0);
}

function decodeUtf8(buffer: Buffer): string | null {
  if (hasNulByte(buffer)) {
    return null;
  }

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return null;
  }
}

function lineCount(text: string): number {
  return text.length === 0 ? 0 : text.split(/\r?\n/u).length;
}

function numberLines(lines: string[], startLine: number): string {
  const width = String(startLine + lines.length - 1).length;
  return lines.map((line, index) => `${String(startLine + index).padStart(width, " ")}\t${line}`).join("\n");
}

export const readTool: Tool<ReadInput> = {
  name: "read",
  description: "Read a UTF-8 text file with line numbers. Supports optional 1-indexed offset and limit.",
  schema: readSchema,
  jsonSchema: {
    type: "object",
    additionalProperties: false,
    required: ["path"],
    properties: {
      path: { type: "string", description: "File path to read" },
      offset: { type: "integer", minimum: 1, description: "1-indexed starting line" },
      limit: { type: "integer", minimum: 1, description: "Maximum number of lines to return" }
    }
  },
  isReadOnly: true,
  activity: (input) => `Reading ${input.path}`,
  execute: async (input, ctx) => {
    const fullPath = resolveToolPath(ctx.cwd, input.path);
    const relPath = displayPath(ctx.cwd, fullPath);

    try {
      const info = await stat(fullPath);
      if (info.isDirectory()) {
        return { isError: true, output: `Cannot read ${relPath}: path is a directory` };
      }

      const buffer = await readFile(fullPath);
      const text = decodeUtf8(buffer);
      if (text === null) {
        return { isError: true, output: `Cannot read ${relPath}: file is not valid UTF-8 text` };
      }

      const lines = text.split(/\r?\n/u);
      const startLine = input.offset ?? 1;
      const startIndex = startLine - 1;
      const requestedLimit = input.limit ?? DEFAULT_MAX_LINES;
      const selected = lines.slice(startIndex, startIndex + requestedLimit);
      const numbered = numberLines(selected, startLine);
      const truncated = truncateHead(numbered, {
        maxLines: input.limit ?? DEFAULT_MAX_LINES,
        maxBytes: DEFAULT_MAX_BYTES
      });

      let output = truncated.text;
      const hiddenLines = Math.max(0, lineCount(text) - (startIndex + selected.length));
      if (hiddenLines > 0 || truncated.truncated) {
        output += `${output.endsWith("\n") || output.length === 0 ? "" : "\n"}... (truncated, ${hiddenLines} more lines)`;
      }

      return { output };
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        return { isError: true, output: `Cannot read ${relPath}: path does not exist` };
      }
      return {
        isError: true,
        output: `Cannot read ${relPath}: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
};
