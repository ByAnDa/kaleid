import React from "react";
import { Box, Text } from "ink";
import type { SlashCommandDefinition } from "../commands.js";

export interface SlashMenuProps {
  commands: SlashCommandDefinition[];
  selectedIndex: number;
}

export function SlashMenu({ commands, selectedIndex }: SlashMenuProps): React.ReactElement {
  if (commands.length === 0) {
    return (
      <Box marginLeft={2}>
        <Text color="yellow">No matching slash commands</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" marginLeft={2}>
      {commands.map((command, index) => {
        const selected = index === selectedIndex;
        return (
          <Text key={command.command} color={selected ? "green" : "gray"}>
            {selected ? "> " : "  "}
            {command.command.padEnd(8)} {command.description}
          </Text>
        );
      })}
    </Box>
  );
}
