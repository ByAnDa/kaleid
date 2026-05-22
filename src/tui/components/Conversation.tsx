import React from "react";
import { Box } from "ink";
import type { Msg } from "../types.js";
import { Message, getMessageStyle } from "./Message.js";
import { formatToolCallLine } from "./ToolCall.js";
import type { ResolvedTuiTheme } from "../theme/index.js";

export type ConversationEntry =
  | { id: string; kind: "message"; msg: Msg }
  | { id: "streaming"; kind: "streaming"; text: string };

export function buildConversationEntries(messages: Msg[], streaming: string | null): ConversationEntry[] {
  const entries: ConversationEntry[] = messages.map((msg) => ({ id: msg.id, kind: "message", msg }));
  if (streaming) {
    entries.push({ id: "streaming", kind: "streaming", text: streaming });
  }

  return entries;
}

export function estimateWrappedLineCount(text: string, width: number): number {
  const wrapWidth = Math.max(1, width);
  return text.split(/\r?\n/u).reduce((total, line) => {
    const length = Array.from(line).length;
    return total + Math.max(1, Math.ceil(length / wrapWidth));
  }, 0);
}

function estimateLabeledTextRows(label: string, text: string, width: number): number {
  const firstLineWidth = Math.max(1, width - label.length - 1);
  const continuationWidth = Math.max(1, width - label.length - 1);
  const [first = "", ...rest] = text.split(/\r?\n/u);

  return (
    estimateWrappedLineCount(first, firstLineWidth) +
    rest.reduce((total, line) => total + estimateWrappedLineCount(line, continuationWidth), 0)
  );
}

export function estimateConversationEntryRows(entry: ConversationEntry, width: number): number {
  if (entry.kind === "streaming") {
    return estimateLabeledTextRows(getMessageStyle("assistant").label, entry.text, width);
  }

  if (entry.msg.role === "tool" && entry.msg.tool) {
    return estimateWrappedLineCount(formatToolCallLine(entry.msg.tool, width), width);
  }

  return estimateLabeledTextRows(getMessageStyle(entry.msg.role).label, entry.msg.text, width);
}

function trimTextToRows(text: string, label: string, height: number, width: number): string {
  const rows = Math.max(1, height);
  const wrapWidth = Math.max(1, width - label.length - 1);
  const sourceLines = text.split(/\r?\n/u);
  const visibleLines: string[] = [];
  let usedRows = 0;

  for (let index = sourceLines.length - 1; index >= 0; index -= 1) {
    const line = sourceLines[index] ?? "";
    const lineRows = estimateWrappedLineCount(line, wrapWidth);
    if (usedRows + lineRows > rows) {
      const remainingRows = rows - usedRows;
      if (remainingRows > 0) {
        const chars = Array.from(line);
        const keepChars = Math.max(1, remainingRows * wrapWidth - 3);
        visibleLines.unshift(`...${chars.slice(-keepChars).join("")}`);
      }
      break;
    }

    visibleLines.unshift(line);
    usedRows += lineRows;
  }

  return visibleLines.join("\n");
}

function trimEntryToHeight(entry: ConversationEntry, height: number, width: number): ConversationEntry {
  if (entry.kind === "streaming") {
    return {
      ...entry,
      text: trimTextToRows(entry.text, getMessageStyle("assistant").label, height, width)
    };
  }

  if (entry.msg.role === "tool" && entry.msg.tool) {
    return entry;
  }

  return {
    ...entry,
    msg: {
      ...entry.msg,
      text: trimTextToRows(entry.msg.text, getMessageStyle(entry.msg.role).label, height, width)
    }
  };
}

export function getVisibleConversationEntries(
  entries: ConversationEntry[],
  height: number,
  width: number
): ConversationEntry[] {
  if (height <= 0) {
    return [];
  }

  const visible: ConversationEntry[] = [];
  let usedRows = 0;

  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (!entry) {
      continue;
    }

    const rows = estimateConversationEntryRows(entry, width);
    if (usedRows + rows > height) {
      if (visible.length === 0) {
        visible.unshift(trimEntryToHeight(entry, height, width));
      }
      break;
    }

    visible.unshift(entry);
    usedRows += rows;
  }

  return visible;
}

export interface ConversationProps {
  messages: Msg[];
  streaming: string | null;
  height: number;
  theme: ResolvedTuiTheme;
  width: number;
}

export function Conversation({ messages, streaming, height, theme, width }: ConversationProps): React.ReactElement {
  const entries = getVisibleConversationEntries(buildConversationEntries(messages, streaming), height, width - 2);

  return (
    <Box flexDirection="column" flexGrow={1} height={height} overflow="hidden" paddingX={1} width={width}>
      {entries.map((entry) =>
        entry.kind === "streaming" ? (
          <Message
            key={entry.id}
            msg={{ id: entry.id, role: "assistant", text: entry.text }}
            theme={theme}
            width={width - 2}
          />
        ) : (
          <Message key={entry.id} msg={entry.msg} theme={theme} width={width - 2} />
        )
      )}
    </Box>
  );
}
