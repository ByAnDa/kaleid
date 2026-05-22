import React from "react";
import { Box, Text } from "ink";
import { providerLabel, type ProviderId, type ReasoningEffort } from "../../provider/models.js";
import type { ResolvedTuiTheme } from "../theme/index.js";
import { ProjectBadge, TagBadge, formatBadgeText } from "./Badges.js";

export const HEADER_HEIGHT = 4;

export interface HeaderProps {
  labels: readonly string[];
  model: string;
  name: string;
  project: string | null;
  provider?: ProviderId;
  reasoningEffort: ReasoningEffort | null;
  theme: ResolvedTuiTheme;
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

function textLength(value: string): number {
  return Array.from(value).length;
}

export function Header({
  labels,
  model,
  name,
  project,
  provider,
  reasoningEffort,
  theme,
  width
}: HeaderProps): React.ReactElement {
  const maxStateWidth = Math.max(0, width - 14);
  const showState = maxStateWidth >= 10;
  const state = truncateHeaderState(formatHeaderState(model, reasoningEffort, provider), maxStateWidth);
  const showContext = width >= 50;
  const visibleName = truncateHeaderState(name, Math.max(8, Math.min(28, width - 44)));
  const visibleProject = project ? truncateHeaderState(project, 16) : null;
  const visibleLabels = labels.slice(0, 2).map((label) => ({ key: label, value: truncateHeaderState(label, 12) }));
  const innerWidth = Math.max(1, width - 4);
  const titleText = "kaleid terminal coding harness";
  const titleState = showState ? state : "";
  const titleGap = " ".repeat(Math.max(0, innerWidth - textLength(titleText) - textLength(titleState)));
  const contextWidth = showContext
    ? textLength(visibleName) +
      (visibleProject ? 1 + textLength(formatBadgeText(visibleProject)) : 0) +
      visibleLabels.reduce((total, label) => total + 1 + textLength(formatBadgeText(`#${label.value}`)), 0)
    : 0;
  const contextGap = " ".repeat(Math.max(0, innerWidth - "welcome back".length - contextWidth));

  return (
    <Box
      borderStyle="single"
      borderColor={theme.border.strong}
      flexDirection="column"
      flexShrink={0}
      height={HEADER_HEIGHT}
      paddingX={1}
      width={width}
    >
      <Box flexDirection="row">
        <Text backgroundColor={theme.surface.chrome} bold color={theme.text.onChrome}>
          kaleid
        </Text>
        <Text backgroundColor={theme.surface.chrome} color={theme.text.onChrome}>
          {" terminal coding harness"}
          {titleGap}
        </Text>
        {showState ? (
          <Text backgroundColor={theme.surface.chrome} color={theme.text.onChrome}>
            {state}
          </Text>
        ) : null}
      </Box>
      <Box flexDirection="row">
        <Text backgroundColor={theme.surface.chrome} color={theme.text.onChrome}>
          welcome back
          {contextGap}
        </Text>
        {showContext ? (
          <>
            <Text backgroundColor={theme.surface.chrome} color={theme.text.onChrome}>
              {visibleName}
            </Text>
            {visibleProject ? (
              <>
                <Text backgroundColor={theme.surface.chrome}> </Text>
                <ProjectBadge project={visibleProject} theme={theme} />
              </>
            ) : null}
            {visibleLabels.map((label) => (
              <React.Fragment key={label.key}>
                <Text backgroundColor={theme.surface.chrome}> </Text>
                <TagBadge label={label.value} theme={theme} />
              </React.Fragment>
            ))}
          </>
        ) : null}
      </Box>
    </Box>
  );
}
