import React from "react";
import { Box, Text } from "ink";
import type { ResolvedTuiTheme } from "../theme/index.js";

export interface ToolCallView {
  name: string;
  args: Record<string, unknown>;
  resultSummary: string;
  isError?: boolean;
}

function singleLine(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  if (maxLength <= 3) {
    return value.slice(0, maxLength);
  }

  return `${value.slice(0, maxLength - 3)}...`;
}

export function formatToolCallParts(tool: ToolCallView, width = 80): {
  invocation: string;
  status: string;
  summary: string;
} {
  const maxWidth = Math.max(24, width);
  const rawArgs = singleLine(JSON.stringify(tool.args));
  const args = truncate(rawArgs, Math.max(8, Math.floor(maxWidth * 0.35)));
  const invocation = `⏺ ${tool.name}(${args})`;
  const status = tool.isError ? "✘" : "✔";
  const summaryBudget = Math.max(8, maxWidth - invocation.length - status.length - 2);
  const summary = truncate(singleLine(tool.resultSummary), summaryBudget);
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
  const parts = formatToolCallParts(tool, width);
  return (
    <Box flexDirection="row" width={width}>
      <Text backgroundColor={theme.role.tool.gutter}>  </Text>
      <Text> </Text>
      <Box flexGrow={1} paddingX={1}>
        <Text backgroundColor={theme.surface.raised}>
          <Text color={theme.role.tool.fg}>{parts.invocation}</Text>{" "}
          <Text color={tool.isError ? theme.status.err : theme.status.ok}>{parts.status}</Text>{" "}
          <Text color={tool.isError ? theme.status.err : theme.text.muted}>{parts.summary}</Text>
        </Text>
      </Box>
    </Box>
  );
}
