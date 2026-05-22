import React from "react";
import { Box, Text } from "ink";
import type { SlashCommandDefinition } from "../commands.js";
import { SlashMenu } from "./SlashMenu.js";
import { StatusLine } from "./StatusLine.js";
import type { TokenState } from "../../loop/session.js";
import type { ProviderId, ReasoningEffort } from "../../provider/models.js";
import type { ResolvedTuiTheme } from "../theme/index.js";
import { MULTILINE_INPUT_NEWLINE_HINT, MultilineInput, getMultilineInputRows } from "./MultilineInput.js";
import { textWidth } from "./text-width.js";

export interface InputBarLayoutState {
  input?: string;
  inputMask?: string;
  inputPrompt?: string;
  inputWidth?: number;
  manualCodePrompt: string | null;
  slashCommandCount: number;
  slashMenuVisible: boolean;
  status: string | null;
  width?: number;
}

export function getInputContentWidth(width: number): number {
  return Math.max(1, width - 4);
}

export function getInputValueWidth(width: number, prompt: string): number {
  return Math.max(1, getInputContentWidth(width) - prompt.length);
}

function getPrompt(inputPrompt: string | undefined, manualCodePrompt: string | null): string {
  return inputPrompt ?? (manualCodePrompt ? "input> " : "› ");
}

export function getInputBarHeight(state: InputBarLayoutState): number {
  const manualPromptRows = state.manualCodePrompt ? 1 : 0;
  const slashMenuRows = state.slashMenuVisible ? Math.max(1, state.slashCommandCount) : 0;
  const prompt = getPrompt(state.inputPrompt, state.manualCodePrompt);
  const inputWidth = state.inputWidth ?? (state.width ? getInputValueWidth(state.width, prompt) : 80);
  const inputRows = getMultilineInputRows(state.input ?? "", inputWidth, { mask: state.inputMask });
  return 4 + inputRows + manualPromptRows + slashMenuRows;
}

export interface InputBarProps extends InputBarLayoutState {
  conversationName: string;
  disabled: boolean;
  disabledLabel?: string;
  input: string;
  inputMask?: string;
  inputPrompt?: string;
  labels: readonly string[];
  model: string;
  onChange: (value: string) => void;
  onSubmit?: (value: string) => void;
  project: string | null;
  provider?: ProviderId;
  reasoningEffort: ReasoningEffort | null;
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

export { truncateConversationLabel } from "./text-width.js";

export function InputBar({
  conversationName,
  disabled,
  disabledLabel,
  input,
  inputMask,
  inputPrompt,
  labels,
  manualCodePrompt,
  model,
  onChange,
  onSubmit,
  project,
  provider,
  reasoningEffort,
  selectedSlashIndex,
  slashCandidates,
  theme,
  tokenState,
  slashMenuVisible,
  status,
  width
}: InputBarProps): React.ReactElement {
  const prompt = getPrompt(inputPrompt, manualCodePrompt);
  const borderColor = inputPrompt
    ? theme.accent.default
    : manualCodePrompt
      ? theme.status.warn
      : disabled
        ? theme.border.subtle
        : theme.accent.default;
  const promptColor = inputPrompt ? theme.accent.default : manualCodePrompt ? theme.status.warn : theme.accent.default;
  const inputWidth = getInputContentWidth(width);
  const inputRows = getMultilineInputRows(input, getInputValueWidth(width, prompt), { mask: inputMask });
  const tokenStatus = formatTokenStatus(tokenState);
  const footerGap = " ".repeat(Math.max(0, width - 2 - textWidth(tokenStatus) - textWidth(MULTILINE_INPUT_NEWLINE_HINT)));

  return (
    <Box flexDirection="column" flexShrink={0} width={width}>
      <StatusLine
        busyStatus={status}
        conversationName={conversationName}
        labels={labels}
        model={model}
        project={project}
        provider={provider}
        reasoningEffort={reasoningEffort}
        theme={theme}
        width={width}
      />
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
