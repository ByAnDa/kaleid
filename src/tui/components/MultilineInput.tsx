import React, { useEffect, useMemo, useState } from "react";
import { Box, Text, useInput } from "ink";
import type { ResolvedTuiTheme } from "../theme/index.js";
import { textWidth, wrapTextLine } from "./text-width.js";

export const MAX_MULTILINE_INPUT_ROWS = 6;
export const MULTILINE_INPUT_NEWLINE_HINT = "Enter send · Ctrl+J newline";
export const INPUT_COMPOSER_HINT = "Enter send · Ctrl+J newline · / commands · /model";

export interface MultilineInputProps {
  disabled: boolean;
  mask?: string;
  onChange: (value: string) => void;
  onSubmit?: (value: string) => void;
  promptSigil?: string;
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

export interface MultilineInputRowsOptions {
  cursor?: number;
  mask?: string;
}

function getMaxCursorRows(value: string, width: number): number {
  const wrapWidth = Math.max(1, width);
  const lines = value.split("\n");
  const baseRows = lines.map((line) => wrapTextLine(line, wrapWidth).length);
  const baseTotal = baseRows.reduce((total, rows) => total + rows, 0);

  return lines.reduce((maxRows, line, index) => {
    const cursorRows = wrapTextLine(insertCursor(line, line.length), wrapWidth).length;
    return Math.max(maxRows, baseTotal - (baseRows[index] ?? 1) + cursorRows);
  }, baseTotal);
}

function wrapDisplayValue(value: string, width: number): string[] {
  return value.split("\n").flatMap((line) => wrapTextLine(line, width));
}

export interface MultilineInputDisplayRow {
  gutter: string;
  hidden: boolean;
  text: string;
}

export function getMultilineInputGutterWidth(value: string): number {
  return Math.max(1, String(Math.max(1, value.split("\n").length)).length);
}

function getMultilineInputDisplayRows(value: string, width: number): MultilineInputDisplayRow[] {
  const gutterWidth = getMultilineInputGutterWidth(value);
  const valueWidth = Math.max(1, width - gutterWidth - 1);
  const rows: MultilineInputDisplayRow[] = [];

  value.split("\n").forEach((line, lineIndex) => {
    const wrapped = wrapTextLine(line, valueWidth);
    wrapped.forEach((text, wrapIndex) => {
      rows.push({
        gutter: lineIndex === 0 && wrapIndex === 0 ? "›" : wrapIndex === 0 ? String(lineIndex + 1) : "",
        hidden: false,
        text
      });
    });
  });

  return rows.length > 0 ? rows : [{ gutter: "›", hidden: false, text: "" }];
}

export function getMultilineInputRows(
  value: string,
  width: number,
  options: MultilineInputRowsOptions = {}
): number {
  const wrapWidth = Math.max(1, width);
  const displayValue = maskValue(value, options.mask);
  const rows =
    options.cursor === undefined
      ? getMaxCursorRows(displayValue, wrapWidth)
      : wrapDisplayValue(insertCursor(displayValue, clamp(options.cursor, 0, displayValue.length)), wrapWidth).length;
  return clamp(rows, 1, MAX_MULTILINE_INPUT_ROWS);
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
  promptSigil = "›",
  promptColor,
  theme,
  value,
  width
}: MultilineInputProps): React.ReactElement {
  const [cursor, setCursor] = useState(value.length);
  const displayValue = useMemo(() => maskValue(value, mask), [mask, value]);
  const cursorValue = insertCursor(displayValue, clamp(cursor, 0, displayValue.length));
  const gutterWidth = Math.max(getMultilineInputGutterWidth(cursorValue), textWidth(promptSigil));
  const wrappedLines = getMultilineInputDisplayRows(cursorValue, width);
  const hiddenRows = Math.max(0, wrappedLines.length - MAX_MULTILINE_INPUT_ROWS);
  const visibleLines = wrappedLines.slice(-MAX_MULTILINE_INPUT_ROWS);
  if (hiddenRows > 0) {
    visibleLines[0] = {
      gutter: "",
      hidden: true,
      text: `... ${hiddenRows} earlier row${hiddenRows === 1 ? "" : "s"}`
    };
  }

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
        const gutter = line.gutter.padStart(gutterWidth, " ");
        const fill = " ".repeat(Math.max(0, width - textWidth(gutter) - 1 - textWidth(line.text)));
        return (
          <Text
            key={index}
            backgroundColor={theme.surface.canvas}
            color={line.hidden ? theme.text.faint : theme.text.primary}
          >
            <Text bold color={promptColor}>
              {gutter}
            </Text>
            <Text color={theme.text.faint}> </Text>
            {line.text}
            {fill}
          </Text>
        );
      })}
    </Box>
  );
}
