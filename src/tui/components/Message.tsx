import React from "react";
import { Box, Text } from "ink";
import { ToolCall } from "./ToolCall.js";
import type { Msg } from "../types.js";
import { DEFAULT_RESOLVED_THEME, type ResolvedTuiTheme, type RoleTokenName } from "../theme/index.js";

export interface MessageStyle {
  label: string;
  color: string;
  gutter: string;
  bold?: boolean;
  dimColor?: boolean;
}

function roleTokenName(role: Msg["role"]): RoleTokenName {
  return role === "error" ? "error" : role;
}

export function getMessageStyle(role: Msg["role"], theme: ResolvedTuiTheme = DEFAULT_RESOLVED_THEME): MessageStyle {
  const token = theme.role[roleTokenName(role)];
  if (role === "user") {
    return { label: "you ›", color: token.fg, gutter: token.gutter, bold: true };
  }

  if (role === "assistant") {
    return { label: "kaleid ›", color: token.fg, gutter: token.gutter };
  }

  if (role === "tool") {
    return { label: "tool ›", color: token.fg, gutter: token.gutter };
  }

  if (role === "system") {
    return { label: "system ›", color: token.fg, gutter: token.gutter, dimColor: true };
  }

  return { label: "error ›", color: token.fg, gutter: token.gutter };
}

export function Message({
  msg,
  theme,
  width
}: {
  msg: Msg;
  theme: ResolvedTuiTheme;
  width?: number;
}): React.ReactElement {
  if (msg.role === "tool" && msg.tool) {
    return <ToolCall theme={theme} tool={msg.tool} width={width} />;
  }

  const style = getMessageStyle(msg.role, theme);
  const lines = msg.text.split(/\r?\n/u);
  const indent = " ".repeat(style.label.length + 1);

  return (
    <Box flexDirection="column" width={width}>
      {lines.map((line, index) => (
        <Box key={index} flexDirection="row" width={width}>
          <Text backgroundColor={style.gutter}>  </Text>
          <Text> </Text>
          <Text color={style.color} dimColor={style.dimColor}>
            <Text bold={style.bold}>{index === 0 ? `${style.label} ` : indent}</Text>
            {line}
          </Text>
        </Box>
      ))}
    </Box>
  );
}
