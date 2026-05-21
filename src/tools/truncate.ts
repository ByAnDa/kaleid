export const DEFAULT_MAX_LINES = 2000;
export const DEFAULT_MAX_BYTES = 50 * 1024;

export interface HeadTruncateOptions {
  maxLines?: number;
  maxBytes?: number;
}

export interface HeadTruncateResult {
  text: string;
  truncated: boolean;
  originalLines: number;
}

export interface TailTruncateResult {
  text: string;
  truncated: boolean;
}

function byteLength(value: string): number {
  return Buffer.byteLength(value, "utf8");
}

function takeHeadBytes(value: string, maxBytes: number): string {
  let used = 0;
  let result = "";
  for (const char of value) {
    const size = byteLength(char);
    if (used + size > maxBytes) {
      break;
    }
    used += size;
    result += char;
  }
  return result;
}

function takeTailBytes(value: string, maxBytes: number): string {
  let used = 0;
  let result = "";
  const chars = Array.from(value);
  for (let i = chars.length - 1; i >= 0; i -= 1) {
    const char = chars[i] ?? "";
    const size = byteLength(char);
    if (used + size > maxBytes) {
      break;
    }
    used += size;
    result = char + result;
  }
  return result;
}

export function truncateHead(
  text: string,
  { maxLines = DEFAULT_MAX_LINES, maxBytes = DEFAULT_MAX_BYTES }: HeadTruncateOptions = {}
): HeadTruncateResult {
  const lines = text.split(/\r?\n/u);
  const originalLines = lines.length;
  let truncated = false;
  let output = text;

  if (lines.length > maxLines) {
    output = lines.slice(0, maxLines).join("\n");
    truncated = true;
  }

  if (byteLength(output) > maxBytes) {
    output = takeHeadBytes(output, maxBytes);
    truncated = true;
  }

  return { text: output, truncated, originalLines };
}

export function truncateTail(
  text: string,
  { maxBytes = DEFAULT_MAX_BYTES }: { maxBytes?: number } = {}
): TailTruncateResult {
  if (byteLength(text) <= maxBytes) {
    return { text, truncated: false };
  }
  return { text: takeTailBytes(text, maxBytes), truncated: true };
}
