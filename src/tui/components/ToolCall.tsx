import React from "react";
import { Box, Text } from "ink";
import { RoleGutter } from "./RoleGutter.js";
import type { ResolvedTuiTheme } from "../theme/index.js";
import { textWidth, truncateEnd, wrapTextLine } from "./text-width.js";

export interface ToolCallView {
  name: string;
  args: Record<string, unknown>;
  result?: string;
  resultSummary: string;
  isError?: boolean;
}

function singleLine(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

export function formatToolCallParts(tool: ToolCallView, width = 80): {
  disclosure: string;
  invocation: string;
  status: string;
  summary: string;
  hint: string;
} {
  const maxWidth = Math.max(8, width);
  const rawArgs = singleLine(JSON.stringify(tool.args));
  const status = tool.isError ? "✘" : "✔";
  const disclosure = "▸";
  const hint = "⏎ to expand";
  const minimumSummaryWidth = Math.min(8, Math.max(1, maxWidth - textWidth(status) - textWidth(disclosure) - 4));
  const invocationBudget = Math.max(
    1,
    Math.min(Math.floor(maxWidth * 0.6), maxWidth - textWidth(status) - textWidth(disclosure) - 4 - minimumSummaryWidth)
  );
  const argsBudget = Math.max(1, invocationBudget - textWidth(`${tool.name}()`));
  const invocation = truncateEnd(`${tool.name}(${truncateEnd(rawArgs, argsBudget)})`, invocationBudget);
  const reservedHintWidth = maxWidth >= 48 ? textWidth(hint) + 1 : 0;
  const summaryBudget = Math.max(
    1,
    maxWidth - textWidth(disclosure) - textWidth(invocation) - textWidth(status) - reservedHintWidth - 4
  );
  const summary = truncateEnd(singleLine(tool.resultSummary), summaryBudget);
  return { disclosure, invocation, status, summary, hint };
}

export function formatToolCallLine(tool: ToolCallView, width = 80): string {
  const parts = formatToolCallParts(tool, width);
  const base = `${parts.disclosure} ${parts.invocation} ${parts.status} ${parts.summary}`;
  if (width >= 48) {
    const gap = " ".repeat(Math.max(1, width - textWidth(base) - textWidth(parts.hint)));
    return truncateEnd(`${base}${gap}${parts.hint}`, width);
  }
  return truncateEnd(base, width);
}

export function formatExpandedToolRows(tool: ToolCallView, width: number): string[] {
  const bodyWidth = Math.max(1, width - 2);
  const source = tool.result && tool.result.length > 0 ? tool.result : tool.resultSummary;
  return source
    .split(/\r?\n/u)
    .flatMap((line) => wrapTextLine(line, bodyWidth))
    .map((line) => truncateEnd(line, bodyWidth));
}

export function ToolCall({
  theme,
  tool,
  expanded = false,
  focused = false,
  width
}: {
  expanded?: boolean;
  focused?: boolean;
  theme: ResolvedTuiTheme;
  tool: ToolCallView;
  width?: number;
}): React.ReactElement {
  const lineWidth = Math.max(1, width ?? 80);
  const panelWidth = Math.max(1, lineWidth - 2);
  const contentWidth = Math.max(1, panelWidth - 2);
  const fittedParts = formatToolCallParts(tool, contentWidth);
  const disclosure = expanded ? "▾" : fittedParts.disclosure;
  const baseLine = `${disclosure} ${fittedParts.invocation} ${fittedParts.status} ${fittedParts.summary}`;
  const hint = !expanded && contentWidth >= 48 ? fittedParts.hint : "";
  const hintGap = hint ? " ".repeat(Math.max(1, contentWidth - textWidth(baseLine) - textWidth(hint))) : "";
  const line = truncateEnd(`${baseLine}${hintGap}${hint}`, contentWidth);
  const fill = " ".repeat(Math.max(0, panelWidth - textWidth(line) - 2));
  const statusPalette = tool.isError ? theme.state.err : theme.state.ok;
  const panelBackground = focused ? theme.selection.bg : theme.surface.raised;
  const outputRows = expanded ? formatExpandedToolRows(tool, contentWidth) : [];
  return (
    <Box flexDirection="row" width={width}>
      <RoleGutter color={theme.role.tool.gutter} theme={theme} />
      <Text backgroundColor={theme.surface.canvas}> </Text>
      <Box flexDirection="column" width={panelWidth}>
        <Text backgroundColor={panelBackground}>
          {" "}
          <Text color={theme.role.tool.fg}>{disclosure}</Text>{" "}
          <Text color={theme.role.tool.fg}>{fittedParts.invocation}</Text>{" "}
          <Text backgroundColor={statusPalette.bg} color={statusPalette.fg}>
            {fittedParts.status}
          </Text>{" "}
          <Text color={tool.isError ? theme.status.err : focused ? theme.selection.fg : theme.text.muted}>
            {fittedParts.summary}
          </Text>
          {hint ? (
            <>
              <Text>{hintGap}</Text>
              <Text color={focused ? theme.selection.fg : theme.text.faint}>{hint}</Text>
            </>
          ) : null}
          {fill}
          {" "}
        </Text>
        {outputRows.map((row, index) => {
          const rowFill = " ".repeat(Math.max(0, contentWidth - textWidth(row)));
          return (
            <Text key={index} backgroundColor={theme.surface.canvas} color={theme.role.tool.fg}>
              {" "}
              {row}
              {rowFill}
              {" "}
            </Text>
          );
        })}
      </Box>
    </Box>
  );
}
