import React from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import type { SlashCommandDefinition } from "../commands.js";
import { SlashMenu } from "./SlashMenu.js";
import { StatusLine } from "./StatusLine.js";
import type { TokenState } from "../../loop/session.js";

export interface InputBarLayoutState {
  manualCodePrompt: string | null;
  slashCommandCount: number;
  slashMenuVisible: boolean;
  status: string | null;
}

export function getInputBarHeight(state: InputBarLayoutState): number {
  const statusRows = state.status ? 1 : 0;
  const manualPromptRows = state.manualCodePrompt ? 1 : 0;
  const slashMenuRows = state.slashMenuVisible ? Math.max(1, state.slashCommandCount) : 0;
  return 4 + statusRows + manualPromptRows + slashMenuRows;
}

export interface InputBarProps extends InputBarLayoutState {
  conversationLabel: string;
  disabled: boolean;
  disabledLabel?: string;
  input: string;
  inputMask?: string;
  onChange: (value: string) => void;
  onSubmit?: (value: string) => void;
  selectedSlashIndex: number;
  slashCandidates: SlashCommandDefinition[];
  tokenState: TokenState;
  width: number;
}

export function formatTokenCount(tokens: number): string {
  if (tokens >= 1000) {
    const value = tokens / 1000;
    return `${value >= 100 ? Math.round(value) : value.toFixed(1)}K`;
  }

  return String(tokens);
}

export function formatTokenStatus(state: TokenState): string {
  return `ctx ${formatTokenCount(state.usedTokens)} / ${formatTokenCount(state.contextWindow)} · ${state.percent.toFixed(1)}%`;
}

function charWidth(char: string): number {
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

function textWidth(value: string): number {
  return Array.from(value).reduce((width, char) => width + charWidth(char), 0);
}

export function truncateConversationLabel(label: string, maxWidth: number): string {
  if (maxWidth <= 0) {
    return "";
  }

  if (textWidth(label) <= maxWidth) {
    return label;
  }

  if (maxWidth <= 3) {
    return ".".repeat(maxWidth);
  }

  const suffix = "...";
  const target = maxWidth - suffix.length;
  let width = 0;
  let result = "";
  for (const char of Array.from(label)) {
    const nextWidth = width + charWidth(char);
    if (nextWidth > target) {
      break;
    }
    result += char;
    width = nextWidth;
  }

  return `${result.trimEnd()}${suffix}`;
}

export function InputBar({
  conversationLabel,
  disabled,
  disabledLabel,
  input,
  inputMask,
  manualCodePrompt,
  onChange,
  onSubmit,
  selectedSlashIndex,
  slashCandidates,
  tokenState,
  slashMenuVisible,
  status,
  width
}: InputBarProps): React.ReactElement {
  const prompt = manualCodePrompt ? "input> " : "› ";
  const borderColor = manualCodePrompt ? "yellow" : disabled ? "gray" : "green";
  const labelMaxWidth = Math.max(0, Math.min(48, width - 12));
  const label = truncateConversationLabel(conversationLabel, labelMaxWidth);

  return (
    <Box flexDirection="column" flexShrink={0} width={width}>
      {status ? <StatusLine status={status} /> : null}
      {manualCodePrompt ? (
        <Box paddingX={1}>
          <Text color="yellow">{manualCodePrompt}</Text>
        </Box>
      ) : null}
      {slashMenuVisible ? <SlashMenu commands={slashCandidates} selectedIndex={selectedSlashIndex} /> : null}
      <Box borderStyle="round" borderColor={borderColor} height={3} paddingX={1} width={width}>
        <Box flexDirection="row" width="100%">
          <Box flexGrow={1} minWidth={0}>
            <Text bold color={manualCodePrompt ? "yellow" : "green"}>
              {prompt}
            </Text>
            {disabled ? (
              <Text color="gray">{disabledLabel ?? status ?? "working..."}</Text>
            ) : (
              <TextInput value={input} mask={inputMask} onChange={onChange} onSubmit={onSubmit} />
            )}
          </Box>
          {label ? (
            <Text color="gray" dimColor>
              {label}
            </Text>
          ) : null}
        </Box>
      </Box>
      <Box paddingX={1}>
        <Text color={tokenState.warning ? "yellow" : "gray"}>{formatTokenStatus(tokenState)}</Text>
      </Box>
    </Box>
  );
}
