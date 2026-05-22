import React from "react";
import { Text } from "ink";
import type { ResolvedTuiTheme } from "../theme/index.js";

export function RoleGutter({ color, theme }: { color: string; theme: ResolvedTuiTheme }): React.ReactElement {
  if (theme.gutterStyle === "bar") {
    return (
      <>
        <Text backgroundColor={theme.surface.canvas} color={color}>
          ▌
        </Text>
        <Text backgroundColor={theme.surface.canvas}> </Text>
      </>
    );
  }

  return <Text backgroundColor={color}>  </Text>;
}
