import React, { useEffect, useMemo, useState } from "react";
import { Box, Text, useInput } from "ink";
import type { ResolvedTuiTheme } from "../theme/index.js";
import { charWidth, textWidth } from "./text-width.js";

export const MAX_MULTILINE_INPUT_ROWS = 6;
export const MULTILINE_INPUT_NEWLINE_HINT = "Enter send · Ctrl+J newline";

export interface MultilineInputProps {
  disabled: boolean;
  mask?: string;
  onChange: (value: string) => void;
  onSubmit?: (value: string) => void;
  prompt: string;
  promptColor: string;
  theme: ResolvedTuiTheme;
  value: string;
  width: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function lineStart(value: string, index: number): number {
  return value.lastIndexOf("\n", Math.max(0, index - 1)) + 1;
}

function lineEnd(value: string, index: number): number {
  const next = value.indexOf("\n", index);
  return next < 0 ? value.length : next;
}

function moveCursorVertically(value: string, cursor: number, direction: -1 | 1): number {
  const currentStart = lineStart(value, cursor);
  const currentColumn = cursor - currentStart;

  if (direction < 0) {
    if (currentStart === 0) {
      return cursor;
    }
    const previousEnd = currentStart - 1;
    const previousStart = lineStart(value, previousEnd);
    return previousStart + Math.min(currentColumn, previousEnd - previousStart);
  }

  const currentEnd = lineEnd(value, cursor);
  if (currentEnd >= value.length) {
    return cursor;
  }

  const nextStart = currentEnd + 1;
  const nextEnd = lineEnd(value, nextStart);
  return nextStart + Math.min(currentColumn, nextEnd - nextStart);
}

function maskValue(value: string, mask?: string): string {
  if (!mask) {
    return value;
  }

  return Array.from(value)
    .map((char) => (char === "\n" ? "\n" : mask))
    .join("");
}

function insertCursor(value: string, cursor: number): string {
  return `${value.slice(0, cursor)}|${value.slice(cursor)}`;
}

export function getMultilineInputRows(value: string, width: number): number {
  const wrapWidth = Math.max(1, width);
  const rows = value.split("\n").reduce((total, line) => {
    const length = Math.max(1, textWidth(line));
    return total + Math.ceil(length / wrapWidth);
  }, 0);
  return clamp(rows, 1, MAX_MULTILINE_INPUT_ROWS);
}

function wrapDisplayLine(line: string, width: number): string[] {
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

function wrapDisplayValue(value: string, width: number): string[] {
  return value.split("\n").flatMap((line) => wrapDisplayLine(line, width));
}

export function normalizeInputText(value: string): string {
  return value.replace(/\u001b(?=\r|\n)/gu, "").replace(/\r\n?/gu, "\n");
}

export function getInputNewline(value: string, key: { ctrl?: boolean; meta?: boolean; return?: boolean }): string | null {
  if (key.meta === true && key.return === true) {
    return "\n";
  }

  if (key.ctrl === true && value.toLowerCase() === "j") {
    return "\n";
  }

  if (key.return === true) {
    return null;
  }

  const normalized = normalizeInputText(value);
  return normalized === "\n" ? "\n" : null;
}

export function shouldInsertInputNewline(value: string, key: { ctrl?: boolean; meta?: boolean; return?: boolean }): boolean {
  return getInputNewline(value, key) !== null;
}

export function MultilineInput({
  disabled,
  mask,
  onChange,
  onSubmit,
  prompt,
  promptColor,
  theme,
  value,
  width
}: MultilineInputProps): React.ReactElement {
  const [cursor, setCursor] = useState(value.length);
  const displayValue = useMemo(() => maskValue(value, mask), [mask, value]);
  const cursorValue = insertCursor(displayValue, clamp(cursor, 0, displayValue.length));
  const valueWidth = Math.max(1, width - prompt.length);
  const wrappedLines = wrapDisplayValue(cursorValue, valueWidth);
  const hiddenRows = Math.max(0, wrappedLines.length - MAX_MULTILINE_INPUT_ROWS);
  const visibleLines = wrappedLines.slice(-MAX_MULTILINE_INPUT_ROWS);
  if (hiddenRows > 0) {
    visibleLines[0] = `... ${hiddenRows} earlier row${hiddenRows === 1 ? "" : "s"}`;
  }
  const promptIndent = " ".repeat(prompt.length);

  useEffect(() => {
    setCursor((current) => clamp(current, 0, value.length));
  }, [value]);

  useInput(
    (input, key) => {
      if (disabled) {
        return;
      }

      const newline = getInputNewline(input, key);
      if (newline) {
        const next = `${value.slice(0, cursor)}${newline}${value.slice(cursor)}`;
        onChange(next);
        setCursor(cursor + newline.length);
        return;
      }

      if (key.return) {
        onSubmit?.(value);
        return;
      }

      if (key.backspace || key.delete) {
        if (cursor === 0) {
          return;
        }
        const next = `${value.slice(0, cursor - 1)}${value.slice(cursor)}`;
        onChange(next);
        setCursor(cursor - 1);
        return;
      }

      if (key.leftArrow) {
        setCursor((current) => clamp(current - 1, 0, value.length));
        return;
      }

      if (key.rightArrow) {
        setCursor((current) => clamp(current + 1, 0, value.length));
        return;
      }

      if (key.upArrow) {
        setCursor((current) => moveCursorVertically(value, current, -1));
        return;
      }

      if (key.downArrow) {
        setCursor((current) => moveCursorVertically(value, current, 1));
        return;
      }

      const normalizedInput = normalizeInputText(input);
      if (normalizedInput && !key.ctrl && !key.meta) {
        const next = `${value.slice(0, cursor)}${normalizedInput}${value.slice(cursor)}`;
        onChange(next);
        setCursor(cursor + normalizedInput.length);
      }
    },
    { isActive: !disabled }
  );

  return (
    <Box flexDirection="column" minWidth={0} width={width}>
      {visibleLines.map((line, index) => {
        const visiblePrompt = index === 0 ? prompt : promptIndent;
        const fill = " ".repeat(Math.max(0, width - textWidth(visiblePrompt) - textWidth(line)));
        return (
          <Text
            key={index}
            backgroundColor={theme.surface.panel}
            color={hiddenRows > 0 && index === 0 ? theme.text.faint : theme.text.primary}
          >
            <Text bold color={promptColor}>
              {visiblePrompt}
            </Text>
            {line}
            {fill}
          </Text>
        );
      })}
    </Box>
  );
}
