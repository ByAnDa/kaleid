import React from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import type { SlashCommandDefinition } from "../commands.js";
import { SlashMenu } from "./SlashMenu.js";
import { StatusLine } from "./StatusLine.js";

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
  return 3 + statusRows + manualPromptRows + slashMenuRows;
}

export interface InputBarProps extends InputBarLayoutState {
  disabled: boolean;
  disabledLabel?: string;
  input: string;
  onChange: (value: string) => void;
  onSubmit?: (value: string) => void;
  selectedSlashIndex: number;
  slashCandidates: SlashCommandDefinition[];
  width: number;
}

export function InputBar({
  disabled,
  disabledLabel,
  input,
  manualCodePrompt,
  onChange,
  onSubmit,
  selectedSlashIndex,
  slashCandidates,
  slashMenuVisible,
  status,
  width
}: InputBarProps): React.ReactElement {
  const prompt = manualCodePrompt ? "oauth> " : "› ";
  const borderColor = manualCodePrompt ? "yellow" : disabled ? "gray" : "green";

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
        <Text bold color={manualCodePrompt ? "yellow" : "green"}>
          {prompt}
        </Text>
        {disabled ? (
          <Text color="gray">{disabledLabel ?? status ?? "working..."}</Text>
        ) : (
          <TextInput value={input} onChange={onChange} onSubmit={onSubmit} />
        )}
      </Box>
    </Box>
  );
}
