import React from "react";
import { Box, Text } from "ink";
import type { SlashCommandDefinition } from "../commands.js";
import { SlashMenu } from "./SlashMenu.js";
import { BusyLine, StatusLine } from "./StatusLine.js";
import type { TokenState } from "../../loop/session.js";
import type { ProviderId, ReasoningEffort } from "../../provider/models.js";
import type { ResolvedTuiTheme } from "../theme/index.js";
import { INPUT_COMPOSER_HINT, MultilineInput, getMultilineInputRows } from "./MultilineInput.js";
import { StateChip, getStateChipWidth, type AgentState } from "./StateChip.js";
import { STATUS_LINE_RIGHT_MARGIN } from "./StatusLine.js";
import { textWidth, truncateEnd } from "./text-width.js";

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
  return Math.max(1, width - 2);
}

export function getInputValueWidth(width: number, prompt: string): number {
  return Math.max(1, getInputContentWidth(width) - textWidth(getInputPromptText(prompt)) - 1);
}

export function getInputFooterGapWidth(width: number, tokenStatus: string): number {
  return Math.max(
    0,
    width - 1 - STATUS_LINE_RIGHT_MARGIN - textWidth(tokenStatus)
  );
}

function getPrompt(inputPrompt: string | undefined, manualCodePrompt: string | null): string {
  return inputPrompt ?? (manualCodePrompt ? "input> " : "› ");
}

function getInputPromptText(prompt: string): string {
  return prompt;
}

export function formatInputHintBar(input: string, width: number): string {
  const lines = Math.max(1, input.split("\n").length);
  const meta = `${Array.from(input).length} chars · ${lines} ${lines === 1 ? "line" : "lines"}`;
  const gap = Math.max(1, width - textWidth(INPUT_COMPOSER_HINT) - textWidth(meta));
  const full = `${INPUT_COMPOSER_HINT}${" ".repeat(gap)}${meta}`;
  return truncateEnd(full, Math.max(1, width));
}

export function getInputBarHeight(state: InputBarLayoutState): number {
  const conversationGapRows = 1;
  const statusRows = 1;
  const busyRows = state.status ? 1 : 0;
  const manualPromptRows = state.manualCodePrompt || state.inputPrompt ? 1 : 0;
  const slashMenuRows = state.slashMenuVisible ? Math.max(1, state.slashCommandCount) : 0;
  const prompt = getPrompt(state.inputPrompt, state.manualCodePrompt);
  const inputWidth = state.inputWidth ?? (state.width ? getInputValueWidth(state.width, prompt) : 80);
  const inputRows = getMultilineInputRows(state.input ?? "", inputWidth, { mask: state.inputMask });
  return conversationGapRows + busyRows + statusRows + inputRows + 4 + manualPromptRows + slashMenuRows;
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
  state: AgentState;
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
  state,
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
  const footerGap = " ".repeat(getInputFooterGapWidth(width, tokenStatus));
  const disabledText = disabledLabel ?? status ?? "working...";
  const disabledFill = " ".repeat(Math.max(0, inputWidth - textWidth("› ") - textWidth(disabledText)));
  const chipWidth = Math.min(getStateChipWidth(state), Math.max(1, Math.floor(width / 2)));
  const statusWidth = Math.max(1, width - chipWidth - 1);
  const hintWidth = Math.max(1, inputWidth - 2);
  const hint = formatInputHintBar(input, hintWidth);

  return (
    <Box flexDirection="column" flexShrink={0} width={width}>
      <Text backgroundColor={theme.surface.canvas}>{" ".repeat(Math.max(1, width))}</Text>
      {status ? <BusyLine status={status} theme={theme} width={width} /> : null}
      <Box flexDirection="row" width={width}>
        <StateChip state={state} theme={theme} width={chipWidth} />
        <Text backgroundColor={theme.surface.canvas}> </Text>
        <StatusLine
          busyStatus={null}
          conversationName={conversationName}
          labels={labels}
          model={model}
          project={project}
          provider={provider}
          reasoningEffort={reasoningEffort}
          theme={theme}
          width={statusWidth}
        />
      </Box>
      {manualCodePrompt || inputPrompt ? (
        <Box paddingX={1}>
          <Text backgroundColor={theme.surface.canvas} color={manualCodePrompt ? theme.status.warn : theme.accent.default}>
            {manualCodePrompt ?? inputPrompt}
          </Text>
        </Box>
      ) : null}
      {slashMenuVisible ? (
        <SlashMenu commands={slashCandidates} selectedIndex={selectedSlashIndex} theme={theme} />
      ) : null}
      <Box
        borderStyle="single"
        borderColor={borderColor}
        height={inputRows + 3}
        width={width}
      >
        <Box flexDirection="column" width="100%">
          <Box flexGrow={1} minWidth={0} width={inputWidth}>
            {disabled ? (
              <Text backgroundColor={theme.surface.canvas} color={theme.text.muted}>
                <Text bold color={promptColor}>
                  {"› "}
                </Text>
                {disabledText}
                {disabledFill}
              </Text>
            ) : (
              <MultilineInput
                disabled={disabled}
                mask={inputMask}
                onChange={onChange}
                onSubmit={onSubmit}
                promptSigil="›"
                promptColor={promptColor}
                theme={theme}
                value={input}
                width={inputWidth}
              />
            )}
          </Box>
          <Text backgroundColor={theme.surface.panel} color={theme.text.faint}>
            {" "}
            {hint}
            {" "}
          </Text>
        </Box>
      </Box>
      <Box paddingX={1} width={width}>
        <Text backgroundColor={theme.surface.canvas} color={tokenState.warning ? theme.status.warn : theme.text.muted}>
          {tokenStatus}
        </Text>
        <Text backgroundColor={theme.surface.canvas}>{footerGap}</Text>
      </Box>
    </Box>
  );
}
