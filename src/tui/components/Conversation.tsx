import React from "react";
import { Box, Text } from "ink";
import type { Msg } from "../types.js";
import { Message, formatMessageRows, getMessageStyle } from "./Message.js";
import { formatExpandedToolRows, formatToolCallLine } from "./ToolCall.js";
import type { ResolvedTuiTheme } from "../theme/index.js";
import { textWidth, wrapTextLine } from "./text-width.js";
import { WELCOME_BANNER_ROWS, WelcomeBanner, type WelcomeBannerState } from "./WelcomeBanner.js";

export type ConversationEntry =
  | ({ id: "__kaleid_intro__"; kind: "welcome"; visibleRows?: number } & WelcomeBannerState)
  | { id: string; kind: "message"; msg: Msg }
  | { id: "streaming"; kind: "streaming"; text: string };

export function buildConversationEntries(
  messages: Msg[],
  streaming: string | null,
  welcome?: WelcomeBannerState | null
): ConversationEntry[] {
  const entries: ConversationEntry[] = welcome
    ? [{ id: "__kaleid_intro__", kind: "welcome", ...welcome }]
    : [];
  entries.push(...messages.map((msg) => ({ id: msg.id, kind: "message" as const, msg })));
  if (streaming) {
    entries.push({ id: "streaming", kind: "streaming", text: streaming });
  }

  return entries;
}

export function estimateWrappedLineCount(text: string, width: number): number {
  const wrapWidth = Math.max(1, width);
  return text.split(/\r?\n/u).reduce((total, line) => total + wrapTextLine(line, wrapWidth).length, 0);
}

function estimateLabeledTextRows(label: string, text: string, width: number): number {
  return formatMessageRows(text, label, width).length;
}

export function estimateConversationEntryRows(
  entry: ConversationEntry,
  width: number,
  expandedToolIds: ReadonlySet<string> = new Set()
): number {
  if (entry.kind === "welcome") {
    return entry.visibleRows ?? WELCOME_BANNER_ROWS;
  }

  if (entry.kind === "streaming") {
    return estimateLabeledTextRows(getMessageStyle("assistant").label, entry.text, width);
  }

  if (entry.msg.role === "tool" && entry.msg.tool) {
    const lineWidth = Math.max(1, width);
    const panelWidth = Math.max(1, lineWidth - 2);
    const contentWidth = Math.max(1, panelWidth - 2);
    if (expandedToolIds.has(entry.msg.id)) {
      return 1 + formatExpandedToolRows(entry.msg.tool, contentWidth).length;
    }
    return estimateWrappedLineCount(formatToolCallLine(entry.msg.tool, contentWidth), contentWidth);
  }

  return estimateLabeledTextRows(getMessageStyle(entry.msg.role).label, entry.msg.text, width);
}

export function estimateConversationRows(
  entries: readonly ConversationEntry[],
  width: number,
  expandedToolIds: ReadonlySet<string> = new Set()
): number {
  if (entries.length === 0) {
    return 0;
  }

  return entries.reduce((total, entry) => total + estimateConversationEntryRows(entry, width, expandedToolIds), 0) + entries.length - 1;
}

function trimTextToRows(text: string, label: string, height: number, width: number): string {
  const rows = Math.max(1, height);
  const wrapWidth = Math.max(1, width - 2 - textWidth(label) - 1);
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
  if (entry.kind === "welcome") {
    return {
      ...entry,
      visibleRows: Math.max(1, Math.min(WELCOME_BANNER_ROWS, height))
    };
  }

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
  width: number,
  expandedToolIds: ReadonlySet<string> = new Set()
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

    const separatorRows = visible.length > 0 ? 1 : 0;
    const rows = estimateConversationEntryRows(entry, width, expandedToolIds);
    if (usedRows + separatorRows + rows > height) {
      if (visible.length === 0) {
        visible.unshift(trimEntryToHeight(entry, height, width));
      } else {
        const remainingRows = height - usedRows - separatorRows;
        if (remainingRows > 0) {
          visible.unshift(trimEntryToHeight(entry, remainingRows, width));
        }
      }
      break;
    }

    visible.unshift(entry);
    usedRows += separatorRows + rows;
  }

  return visible;
}

export interface ConversationProps {
  expandedToolIds?: ReadonlySet<string>;
  focusedToolId?: string | null;
  messages: Msg[];
  streaming: string | null;
  height: number;
  theme: ResolvedTuiTheme;
  welcome?: WelcomeBannerState | null;
  width: number;
}

export function Conversation({
  expandedToolIds = new Set(),
  focusedToolId = null,
  messages,
  streaming,
  height,
  theme,
  welcome,
  width
}: ConversationProps): React.ReactElement {
  const allEntries = buildConversationEntries(messages, streaming, welcome);
  const entries = getVisibleConversationEntries(allEntries, height, width, expandedToolIds);
  const usedRows = estimateConversationRows(entries, width, expandedToolIds);
  const emptyRows = Math.max(0, height - usedRows);
  const overflowed = entries.length < allEntries.length;
  const fill = " ".repeat(Math.max(1, width));
  const emptyFillRows = Array.from({ length: emptyRows }, (_, index) => (
    <Text key={`empty-${index}`} backgroundColor={theme.surface.canvas}>
      {fill}
    </Text>
  ));
  const renderedEntries = entries.flatMap((entry, index) => {
    const element =
      entry.kind === "welcome" ? (
        <WelcomeBanner
          key={entry.id}
          maxRows={entry.visibleRows}
          model={entry.model}
          provider={entry.provider}
          reasoningEffort={entry.reasoningEffort}
          theme={theme}
          width={width}
        />
      ) : entry.kind === "streaming" ? (
        <Message key={entry.id} msg={{ id: entry.id, role: "assistant", text: entry.text }} theme={theme} width={width} />
      ) : (
        <Message
          expandedToolIds={expandedToolIds}
          focusedToolId={focusedToolId}
          key={entry.id}
          msg={entry.msg}
          theme={theme}
          width={width}
        />
      );

    if (index === entries.length - 1) {
      return [element];
    }

    return [
      element,
      <Text key={`gap-${entry.id}`} backgroundColor={theme.surface.canvas}>
        {fill}
      </Text>
    ];
  });

  return (
    <Box flexDirection="column" flexGrow={1} height={height} overflow="hidden" width={width}>
      {overflowed ? emptyFillRows : null}
      {renderedEntries}
      {overflowed ? null : emptyFillRows}
    </Box>
  );
}
