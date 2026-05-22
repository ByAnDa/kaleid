import React from "react";
import { Text } from "ink";
import type { ResolvedTuiTheme } from "../theme/index.js";

export const ROLE_GUTTER_SYMBOL = "▏";

export function RoleGutter({ color, theme }: { color: string; theme: ResolvedTuiTheme }): React.ReactElement {
  return (
    <Text backgroundColor={theme.surface.canvas} color={color}>
      {ROLE_GUTTER_SYMBOL}
    </Text>
  );
}
