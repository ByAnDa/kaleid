import React from "react";
import { Box, Text } from "ink";

export interface ToolCallView {
  name: string;
  args: Record<string, unknown>;
  resultSummary: string;
  isError?: boolean;
}

export function ToolCall({ tool }: { tool: ToolCallView }): React.ReactElement {
  const args = JSON.stringify(tool.args);
  return (
    <Box flexDirection="column">
      <Text color="magenta">
        tool {tool.name}({args})
      </Text>
      <Text color={tool.isError ? "red" : "green"}>{tool.isError ? "err" : "ok"} {tool.resultSummary}</Text>
    </Box>
  );
}
