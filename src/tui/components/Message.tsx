import React from "react";
import { Box, Text } from "ink";
import { ToolCall } from "./ToolCall.js";
import type { Msg } from "../types.js";

export interface MessageStyle {
  label: string;
  color: "cyan" | "gray" | "green" | "magenta" | "red";
  bold?: boolean;
  dimColor?: boolean;
}

export function getMessageStyle(role: Msg["role"]): MessageStyle {
  if (role === "user") {
    return { label: "you ›", color: "green", bold: true };
  }

  if (role === "assistant") {
    return { label: "kaleid ›", color: "cyan" };
  }

  if (role === "tool") {
    return { label: "tool ›", color: "magenta" };
  }

  if (role === "system") {
    return { label: "system ›", color: "gray", dimColor: true };
  }

  return { label: "error ›", color: "red" };
}

export function Message({ msg, width }: { msg: Msg; width?: number }): React.ReactElement {
  if (msg.role === "tool" && msg.tool) {
    return <ToolCall tool={msg.tool} width={width} />;
  }

  const style = getMessageStyle(msg.role);
  const lines = msg.text.split(/\r?\n/u);
  const indent = " ".repeat(style.label.length + 1);

  return (
    <Box flexDirection="column" width={width}>
      {lines.map((line, index) => (
        <Text key={index} dimColor={style.dimColor}>
          <Text bold={style.bold} color={style.color}>
            {index === 0 ? `${style.label} ` : indent}
          </Text>
          {line}
        </Text>
      ))}
    </Box>
  );
}
