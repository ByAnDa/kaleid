import React from "react";
import { Box, Text } from "ink";
import type { SlashCommandDefinition } from "../commands.js";
import type { ResolvedTuiTheme } from "../theme/index.js";

export interface SlashMenuProps {
  commands: SlashCommandDefinition[];
  selectedIndex: number;
  theme: ResolvedTuiTheme;
}

export function SlashMenu({ commands, selectedIndex, theme }: SlashMenuProps): React.ReactElement {
  if (commands.length === 0) {
    return (
      <Box marginLeft={2}>
        <Text backgroundColor={theme.surface.raised} color={theme.status.warn}>
          No matching slash commands
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" marginLeft={2}>
      {commands.map((command, index) => {
        const selected = index === selectedIndex;
        return (
          <Text
            key={command.command}
            backgroundColor={selected ? theme.selection.bg : theme.surface.raised}
            color={selected ? theme.selection.fg : theme.text.muted}
          >
            {selected ? "> " : "  "}
            {command.command.padEnd(8)} {command.description}
          </Text>
        );
      })}
    </Box>
  );
}
