import React from "react";
import { Text } from "ink";

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

export function ToolCall({ tool, width }: { tool: ToolCallView; width?: number }): React.ReactElement {
  const parts = formatToolCallParts(tool, width);
  return (
    <Text>
      <Text color="magenta">{parts.invocation}</Text>{" "}
      <Text color={tool.isError ? "red" : "green"}>{parts.status}</Text>{" "}
      <Text color={tool.isError ? "red" : "gray"}>{parts.summary}</Text>
    </Text>
  );
}
