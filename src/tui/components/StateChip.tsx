import React from "react";
import { Box, Text } from "ink";
import type { ResolvedTuiTheme, StateTokenName } from "../theme/index.js";
import { textWidth, truncateEnd } from "./text-width.js";

export type AgentState = Exclude<StateTokenName, "approving">;

const STATE_LABELS: Record<AgentState, string> = {
  idle: "idle",
  typing: "typing",
  thinking: "thinking",
  streaming: "streaming",
  running: "running",
  ok: "ready",
  err: "error"
};

export function formatStateChipText(state: AgentState): string {
  return `● ${STATE_LABELS[state]}`;
}

export function getStateChipWidth(state: AgentState): number {
  return textWidth(formatStateChipText(state)) + 2;
}

export function StateChip({
  state,
  theme,
  width
}: {
  state: AgentState;
  theme: ResolvedTuiTheme;
  width?: number;
}): React.ReactElement {
  const palette = theme.state[state];
  const contentWidth = Math.max(1, (width ?? getStateChipWidth(state)) - 2);
  const labelBudget = Math.max(0, contentWidth - 2);
  const visibleLabel = labelBudget > 0 ? truncateEnd(STATE_LABELS[state], labelBudget) : "";
  const fill = " ".repeat(Math.max(0, contentWidth - 2 - textWidth(visibleLabel)));

  return (
    <Box width={width ?? getStateChipWidth(state)}>
      <Text backgroundColor={palette.bg} color={palette.fg}>
        {" "}
        <Text color={palette.dot}>●</Text>
        {visibleLabel ? ` ${visibleLabel}` : ""}
        {fill}
        {" "}
      </Text>
    </Box>
  );
}
