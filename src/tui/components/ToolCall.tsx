import React from "react";
import { Box, Text } from "ink";
import { RoleGutter } from "./RoleGutter.js";
import type { ResolvedTuiTheme } from "../theme/index.js";
import { textWidth, truncateEnd } from "./text-width.js";

export interface ToolCallView {
  name: string;
  args: Record<string, unknown>;
  resultSummary: string;
  isError?: boolean;
}

function singleLine(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

export function formatToolCallParts(tool: ToolCallView, width = 80): {
  invocation: string;
  status: string;
  summary: string;
} {
  const maxWidth = Math.max(8, width);
  const rawArgs = singleLine(JSON.stringify(tool.args));
  const status = tool.isError ? "✘" : "✔";
  const minimumSummaryWidth = Math.min(8, Math.max(1, maxWidth - textWidth(status) - 2));
  const invocationBudget = Math.max(
    1,
    Math.min(Math.floor(maxWidth * 0.6), maxWidth - textWidth(status) - 2 - minimumSummaryWidth)
  );
  const argsBudget = Math.max(1, invocationBudget - textWidth(`⏺ ${tool.name}()`));
  const invocation = truncateEnd(`⏺ ${tool.name}(${truncateEnd(rawArgs, argsBudget)})`, invocationBudget);
  const summaryBudget = Math.max(1, maxWidth - textWidth(invocation) - textWidth(status) - 2);
  const summary = truncateEnd(singleLine(tool.resultSummary), summaryBudget);
  return { invocation, status, summary };
}

export function formatToolCallLine(tool: ToolCallView, width = 80): string {
  const parts = formatToolCallParts(tool, width);
  return `${parts.invocation} ${parts.status} ${parts.summary}`;
}

export function ToolCall({
  theme,
  tool,
  width
}: {
  theme: ResolvedTuiTheme;
  tool: ToolCallView;
  width?: number;
}): React.ReactElement {
  const lineWidth = Math.max(1, width ?? 80);
  const panelWidth = Math.max(1, lineWidth - 2);
  const contentWidth = Math.max(1, panelWidth - 2);
  const fittedParts = formatToolCallParts(tool, contentWidth);
  const line = `${fittedParts.invocation} ${fittedParts.status} ${fittedParts.summary}`;
  const fill = " ".repeat(Math.max(0, panelWidth - textWidth(line) - 2));
  return (
    <Box flexDirection="row" width={width}>
      <RoleGutter color={theme.role.tool.gutter} theme={theme} />
      <Text backgroundColor={theme.surface.canvas}> </Text>
      <Text backgroundColor={theme.surface.raised}>
        {" "}
        <Text color={theme.role.tool.fg}>{fittedParts.invocation}</Text>{" "}
        <Text color={tool.isError ? theme.status.err : theme.status.ok}>{fittedParts.status}</Text>{" "}
        <Text color={tool.isError ? theme.status.err : theme.text.muted}>{fittedParts.summary}</Text>
        {" "}
        {fill}
      </Text>
    </Box>
  );
}
