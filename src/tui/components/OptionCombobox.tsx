import React from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import type { ResolvedTuiTheme } from "../theme/index.js";

export interface OptionComboboxItem {
  id: string;
  display?: string;
  current: boolean;
}

export interface OptionComboboxProps {
  title: string;
  input: string;
  options: OptionComboboxItem[];
  selectedIndex: number;
  theme: ResolvedTuiTheme;
  width: number;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
}

export function isOptionComboboxTyping(input: string): boolean {
  return input.length > 0;
}

export function getOptionComboboxHeight(optionCount: number, input: string): number {
  const optionRows = isOptionComboboxTyping(input) ? 0 : Math.max(1, optionCount);
  return 4 + optionRows;
}

export function formatOptionComboboxLine(option: OptionComboboxItem, selected: boolean): string {
  const focusMark = selected ? "> " : "  ";
  const currentMark = option.current ? "* " : "  ";
  const primary = option.display ?? option.id;
  const current = option.current ? " (current)" : "";
  return `${focusMark}${currentMark}${primary}${current}`;
}

export function OptionCombobox({
  title,
  input,
  options,
  selectedIndex,
  theme,
  width,
  onChange,
  onSubmit
}: OptionComboboxProps): React.ReactElement {
  const typing = isOptionComboboxTyping(input);

  return (
    <Box
      borderStyle="single"
      borderColor={theme.border.default}
      flexDirection="column"
      flexShrink={0}
      paddingX={1}
      width={width}
    >
      <Text backgroundColor={theme.surface.raised} bold color={theme.accent.default}>
        {title}
      </Text>
      <Box flexDirection="row">
        <Text backgroundColor={theme.surface.raised} bold color={theme.accent.default}>
          ›{" "}
        </Text>
        <TextInput value={input} onChange={onChange} onSubmit={onSubmit} />
      </Box>
      {!typing && options.length === 0 ? (
        <Text backgroundColor={theme.surface.raised} color={theme.status.warn}>
          No options
        </Text>
      ) : !typing ? (
        options.map((option, index) => {
          const selected = index === selectedIndex;
          return (
            <Text
              key={option.id}
              backgroundColor={selected ? theme.selection.bg : theme.surface.raised}
              color={selected ? theme.selection.fg : option.current ? theme.text.primary : theme.text.muted}
            >
              {formatOptionComboboxLine(option, selected)}
            </Text>
          );
        })
      ) : null}
    </Box>
  );
}
