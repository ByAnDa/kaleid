import React from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";

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
  width,
  onChange,
  onSubmit
}: OptionComboboxProps): React.ReactElement {
  const typing = isOptionComboboxTyping(input);

  return (
    <Box borderStyle="round" borderColor="cyan" flexDirection="column" flexShrink={0} paddingX={1} width={width}>
      <Text bold color="cyan">
        {title}
      </Text>
      <Box flexDirection="row">
        <Text bold color="green">
          ›{" "}
        </Text>
        <TextInput value={input} onChange={onChange} onSubmit={onSubmit} />
      </Box>
      {!typing && options.length === 0 ? (
        <Text color="yellow">No options</Text>
      ) : !typing ? (
        options.map((option, index) => {
          const selected = index === selectedIndex;
          return (
            <Text
              key={option.id}
              backgroundColor={selected ? "green" : undefined}
              color={selected ? "black" : option.current ? "white" : "gray"}
            >
              {formatOptionComboboxLine(option, selected)}
            </Text>
          );
        })
      ) : null}
    </Box>
  );
}
