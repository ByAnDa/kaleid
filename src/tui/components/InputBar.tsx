import React from "react";
import { Box, Text } from "ink";
import type { SlashCommandDefinition } from "../commands.js";
import { SlashMenu } from "./SlashMenu.js";
import { StatusLine } from "./StatusLine.js";
import type { TokenState } from "../../loop/session.js";
import type { ResolvedTuiTheme } from "../theme/index.js";
import { MULTILINE_INPUT_NEWLINE_HINT, MultilineInput, getMultilineInputRows } from "./MultilineInput.js";

export interface InputBarLayoutState {
  input?: string;
  inputWidth?: number;
  manualCodePrompt: string | null;
  slashCommandCount: number;
  slashMenuVisible: boolean;
  status: string | null;
}

export function getInputBarHeight(state: InputBarLayoutState): number {
  const statusRows = state.status ? 1 : 0;
  const manualPromptRows = state.manualCodePrompt ? 1 : 0;
  const slashMenuRows = state.slashMenuVisible ? Math.max(1, state.slashCommandCount) : 0;
  const inputRows = getMultilineInputRows(state.input ?? "", state.inputWidth ?? 80);
  return 3 + inputRows + statusRows + manualPromptRows + slashMenuRows;
}

export interface InputBarProps extends InputBarLayoutState {
  conversationLabel: string;
  disabled: boolean;
  disabledLabel?: string;
  input: string;
  inputMask?: string;
  inputPrompt?: string;
  onChange: (value: string) => void;
  onSubmit?: (value: string) => void;
  selectedSlashIndex: number;
  slashCandidates: SlashCommandDefinition[];
  theme: ResolvedTuiTheme;
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
  inputPrompt,
  manualCodePrompt,
  onChange,
  onSubmit,
  selectedSlashIndex,
  slashCandidates,
  theme,
  tokenState,
  slashMenuVisible,
  status,
  width
}: InputBarProps): React.ReactElement {
  const prompt = inputPrompt ?? (manualCodePrompt ? "input> " : "› ");
  const borderColor = inputPrompt
    ? theme.accent.default
    : manualCodePrompt
      ? theme.status.warn
      : disabled
        ? theme.border.subtle
        : theme.accent.default;
  const promptColor = inputPrompt ? theme.accent.default : manualCodePrompt ? theme.status.warn : theme.accent.default;
  const labelMaxWidth = Math.max(0, Math.min(48, width - 12));
  const label = truncateConversationLabel(conversationLabel, labelMaxWidth);
  const inputRows = getMultilineInputRows(input, Math.max(1, width - prompt.length - label.length - 8));
  const inputWidth = Math.max(1, width - label.length - 6);
  const tokenStatus = formatTokenStatus(tokenState);
  const footerGap = " ".repeat(Math.max(0, width - 2 - textWidth(tokenStatus) - textWidth(MULTILINE_INPUT_NEWLINE_HINT)));

  return (
    <Box flexDirection="column" flexShrink={0} width={width}>
      {status ? <StatusLine status={status} theme={theme} /> : null}
      {manualCodePrompt ? (
        <Box paddingX={1}>
          <Text backgroundColor={theme.surface.canvas} color={theme.status.warn}>
            {manualCodePrompt}
          </Text>
        </Box>
      ) : null}
      {slashMenuVisible ? (
        <SlashMenu commands={slashCandidates} selectedIndex={selectedSlashIndex} theme={theme} />
      ) : null}
      <Box
        borderStyle="single"
        borderColor={borderColor}
        height={inputRows + 2}
        paddingX={1}
        width={width}
      >
        <Box flexDirection="row" width="100%">
          <Box flexGrow={1} minWidth={0} width={inputWidth}>
            {disabled ? (
              <Text backgroundColor={theme.surface.panel} color={theme.text.muted}>
                <Text bold color={promptColor}>
                  {prompt}
                </Text>
                {disabledLabel ?? status ?? "working..."}
              </Text>
            ) : (
              <MultilineInput
                disabled={disabled}
                mask={inputMask}
                onChange={onChange}
                onSubmit={onSubmit}
                prompt={prompt}
                promptColor={promptColor}
                theme={theme}
                value={input}
                width={inputWidth}
              />
            )}
          </Box>
          {label ? (
            <Text color={theme.text.subtle} dimColor>
              {label}
            </Text>
          ) : null}
        </Box>
      </Box>
      <Box paddingX={1}>
        <Text backgroundColor={theme.surface.canvas} color={tokenState.warning ? theme.status.warn : theme.text.muted}>
          {tokenStatus}
        </Text>
        <Text backgroundColor={theme.surface.canvas}>{footerGap}</Text>
        <Text backgroundColor={theme.surface.canvas} color={theme.text.faint}>
          {MULTILINE_INPUT_NEWLINE_HINT}
        </Text>
      </Box>
    </Box>
  );
}
