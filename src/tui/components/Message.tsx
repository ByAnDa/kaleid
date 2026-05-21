import React from "react";
import { Box, Text } from "ink";
import { ToolCall } from "./ToolCall.js";
import type { Msg } from "../app.js";

export function Message({ msg }: { msg: Msg }): React.ReactElement {
  if (msg.role === "tool" && msg.tool) {
    return <ToolCall tool={msg.tool} />;
  }

  const label = msg.role === "user" ? "you" : msg.role;
  const color =
    msg.role === "user" ? "blue" : msg.role === "assistant" ? "cyan" : msg.role === "system" ? "green" : "red";

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color={color}>{label}</Text>
      <Text>{msg.text}</Text>
    </Box>
  );
}
