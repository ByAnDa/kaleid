import React from "react";
import { Box, Text } from "ink";
import type { ResolvedTuiTheme } from "../theme/index.js";

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
  theme: ResolvedTuiTheme;
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
  theme,
  width
}: OptionSelectorProps): React.ReactElement {
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
      {options.length === 0 ? (
        <Text backgroundColor={theme.surface.raised} color={theme.status.warn}>
          No options
        </Text>
      ) : (
        options.map((option, index) => {
          const selected = index === selectedIndex;
          const color = option.disabled
            ? theme.status.warn
            : selected
              ? theme.selection.fg
              : option.current
                ? theme.text.primary
                : theme.text.muted;
          return (
            <Text
              key={option.id}
              backgroundColor={selected && !option.disabled ? theme.selection.bg : theme.surface.raised}
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
