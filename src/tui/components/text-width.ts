export function charWidth(char: string): number {
  const code = char.codePointAt(0) ?? 0;
  if (
    (code >= 0x0300 && code <= 0x036f) ||
    (code >= 0x1ab0 && code <= 0x1aff) ||
    (code >= 0x1dc0 && code <= 0x1dff) ||
    (code >= 0x20d0 && code <= 0x20ff) ||
    (code >= 0xfe20 && code <= 0xfe2f)
  ) {
    return 0;
  }

  if (
    code >= 0x1100 &&
    (code <= 0x115f ||
      code === 0x2329 ||
      code === 0x232a ||
      (code >= 0x2e80 && code <= 0xa4cf && code !== 0x303f) ||
      (code >= 0xac00 && code <= 0xd7a3) ||
      (code >= 0xf900 && code <= 0xfaff) ||
      (code >= 0xfe10 && code <= 0xfe19) ||
      (code >= 0xfe30 && code <= 0xfe6f) ||
      (code >= 0xff00 && code <= 0xff60) ||
      (code >= 0xffe0 && code <= 0xffe6))
  ) {
    return 2;
  }

  return 1;
}

export function textWidth(value: string): number {
  return Array.from(value).reduce((width, char) => width + charWidth(char), 0);
}

export function wrapTextLine(line: string, width: number): string[] {
  const wrapWidth = Math.max(1, width);
  if (line.length === 0) {
    return [""];
  }

  const rows: string[] = [];
  let row = "";
  let rowWidth = 0;

  for (const char of Array.from(line)) {
    const nextWidth = rowWidth + charWidth(char);
    if (row.length > 0 && nextWidth > wrapWidth) {
      rows.push(row);
      row = char;
      rowWidth = charWidth(char);
    } else {
      row += char;
      rowWidth = nextWidth;
    }
  }

  rows.push(row);
  return rows;
}

export function truncateEnd(value: string, maxWidth: number, suffix = "…"): string {
  if (maxWidth <= 0) {
    return "";
  }

  if (textWidth(value) <= maxWidth) {
    return value;
  }

  const suffixWidth = textWidth(suffix);
  if (maxWidth <= suffixWidth) {
    return suffix.slice(0, maxWidth);
  }

  const target = maxWidth - suffixWidth;
  let width = 0;
  let result = "";
  for (const char of Array.from(value)) {
    const nextWidth = width + charWidth(char);
    if (nextWidth > target) {
      break;
    }
    result += char;
    width = nextWidth;
  }

  return `${result.trimEnd()}${suffix}`;
}

export function truncateConversationLabel(label: string, maxWidth: number): string {
  return truncateEnd(label, maxWidth);
}
