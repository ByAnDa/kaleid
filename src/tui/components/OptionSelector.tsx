import React from "react";
import { Box, Text } from "ink";

export interface OptionSelectorItem {
  id: string;
  label?: string;
  display?: string;
  current: boolean;
  provider?: string;
  disabled?: boolean;
}

export interface OptionSelectorProps {
  title: string;
  options: OptionSelectorItem[];
  selectedIndex: number;
  width: number;
}

export function getOptionSelectorHeight(optionCount: number): number {
  return 3 + Math.max(1, optionCount);
}

export function formatOptionSelectorLine(option: OptionSelectorItem, selected: boolean): string {
  const focusMark = selected ? "> " : "  ";
  const currentMark = option.current ? "* " : "  ";
  const primary = option.display ?? option.id;
  const label = option.display ? "" : option.label ? ` - ${option.label}` : "";
  const current = option.current ? " (current)" : "";
  return `${focusMark}${currentMark}${primary}${label}${current}`;
}

export function OptionSelector({
  title,
  options,
  selectedIndex,
  width
}: OptionSelectorProps): React.ReactElement {
  return (
    <Box borderStyle="round" borderColor="cyan" flexDirection="column" flexShrink={0} paddingX={1} width={width}>
      <Text bold color="cyan">
        {title}
      </Text>
      {options.length === 0 ? (
        <Text color="yellow">No options</Text>
      ) : (
        options.map((option, index) => {
          const selected = index === selectedIndex;
          const color = option.disabled ? "yellow" : selected ? "black" : option.current ? "white" : "gray";
          return (
            <Text
              key={option.id}
              backgroundColor={selected && !option.disabled ? "green" : undefined}
              color={color}
            >
              {formatOptionSelectorLine(option, selected)}
            </Text>
          );
        })
      )}
    </Box>
  );
}
