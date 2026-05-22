import React, { useEffect, useMemo, useState } from "react";
import { Box, Text, useInput } from "ink";
import type { ResolvedTuiTheme } from "../theme/index.js";

export const MAX_MULTILINE_INPUT_ROWS = 6;

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
    const length = Math.max(1, Array.from(line).length);
    return total + Math.ceil(length / wrapWidth);
  }, 0);
  return clamp(rows, 1, MAX_MULTILINE_INPUT_ROWS);
}

export function shouldInsertInputNewline(value: string, key: { ctrl?: boolean; meta?: boolean; return?: boolean }): boolean {
  return (key.meta === true && key.return === true) || (key.ctrl === true && value.toLowerCase() === "j");
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
  const visibleLines = cursorValue.split("\n").slice(-MAX_MULTILINE_INPUT_ROWS);
  const hiddenRows = Math.max(0, cursorValue.split("\n").length - visibleLines.length);
  const promptIndent = " ".repeat(prompt.length);

  useEffect(() => {
    setCursor((current) => clamp(current, 0, value.length));
  }, [value]);

  useInput(
    (input, key) => {
      if (disabled) {
        return;
      }

      if (shouldInsertInputNewline(input, key)) {
        const next = `${value.slice(0, cursor)}\n${value.slice(cursor)}`;
        onChange(next);
        setCursor(cursor + 1);
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

      if (input && !key.ctrl && !key.meta) {
        const next = `${value.slice(0, cursor)}${input}${value.slice(cursor)}`;
        onChange(next);
        setCursor(cursor + input.length);
      }
    },
    { isActive: !disabled }
  );

  return (
    <Box flexDirection="column" minWidth={0} width={width}>
      {hiddenRows > 0 ? (
        <Text color={theme.text.faint}>{`${promptIndent}... ${hiddenRows} earlier line${hiddenRows === 1 ? "" : "s"}`}</Text>
      ) : null}
      {visibleLines.map((line, index) => (
        <Text key={index} color={theme.text.primary}>
          <Text bold color={promptColor}>
            {index === 0 ? prompt : promptIndent}
          </Text>
          {line}
        </Text>
      ))}
    </Box>
  );
}
