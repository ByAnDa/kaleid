import React from "react";
import { Box, Text } from "ink";
import { providerLabel, type ProviderId, type ReasoningEffort } from "../../provider/models.js";

export const HEADER_HEIGHT = 3;

export interface HeaderProps {
  model: string;
  provider?: ProviderId;
  reasoningEffort: ReasoningEffort | null;
  width: number;
}

export function formatHeaderState(
  model: string,
  reasoningEffort: ReasoningEffort | null,
  provider?: ProviderId
): string {
  const suffix = provider ? ` ${providerLabel(provider)}` : "";
  return `${model}${suffix} · ${reasoningEffort ?? "-"}`;
}

export function truncateHeaderState(value: string, maxWidth: number): string {
  if (value.length <= maxWidth) {
    return value;
  }

  if (maxWidth <= 3) {
    return ".".repeat(Math.max(0, maxWidth));
  }

  return `${value.slice(0, maxWidth - 3)}...`;
}

export function Header({ model, provider, reasoningEffort, width }: HeaderProps): React.ReactElement {
  const maxStateWidth = Math.max(0, width - 14);
  const showState = maxStateWidth >= 10;
  const state = truncateHeaderState(formatHeaderState(model, reasoningEffort, provider), maxStateWidth);

  return (
    <Box borderStyle="round" borderColor="cyan" flexShrink={0} height={HEADER_HEIGHT} paddingX={1} width={width}>
      <Text bold color="cyan">
        kaleid
      </Text>
      {showState ? (
        <>
          <Box flexGrow={1} />
          <Text color="gray">{state}</Text>
        </>
      ) : null}
    </Box>
  );
}
