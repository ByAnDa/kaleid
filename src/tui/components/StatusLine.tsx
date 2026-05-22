import React from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import { providerLabel, type ProviderId, type ReasoningEffort } from "../../provider/models.js";
import type { ResolvedTuiTheme } from "../theme/index.js";
import { ProjectBadge, TagBadge, formatBadgeText } from "./Badges.js";
import { textWidth, truncateConversationLabel, truncateEnd } from "./text-width.js";

const STATUS_SEPARATOR = " · ";
const MAX_STATUS_LABELS = 2;

export interface StatusLineState {
  busyStatus: string | null;
  conversationName: string;
  labels: readonly string[];
  model: string;
  project: string | null;
  provider?: ProviderId;
  reasoningEffort: ReasoningEffort | null;
}

export interface StatusLineLayout {
  busyStatus: string | null;
  fallbackText: string | null;
  labels: string[];
  modelState: string;
  name: string;
  project: string | null;
  width: number;
}

function visibleLabel(label: string): string {
  return label.replace(/^#/u, "");
}

function projectBadgeWidth(project: string): number {
  return textWidth(formatBadgeText(project));
}

function labelBadgeWidth(label: string): number {
  return textWidth(formatBadgeText(`#${visibleLabel(label)}`));
}

export function formatStatusModel(
  model: string,
  reasoningEffort: ReasoningEffort | null,
  provider?: ProviderId
): string {
  const suffix = provider ? ` ${providerLabel(provider)}` : "";
  return `${model}${suffix} · ${reasoningEffort ?? "-"}`;
}

export function formatStatusLineText(state: StatusLineState): string {
  return [
    state.busyStatus,
    state.conversationName,
    state.project,
    ...state.labels.map((label) => `#${visibleLabel(label)}`),
    formatStatusModel(state.model, state.reasoningEffort, state.provider)
  ]
    .filter((part): part is string => Boolean(part))
    .join(STATUS_SEPARATOR);
}

function fixedTailWidth(project: string | null, labels: readonly string[], modelState: string): number {
  const parts = [
    ...(project ? [projectBadgeWidth(project)] : []),
    ...labels.map(labelBadgeWidth),
    textWidth(modelState)
  ];
  return parts.reduce((total, width) => total + width, 0) + STATUS_SEPARATOR.length * parts.length;
}

function busyWidth(status: string | null): number {
  return status ? 2 + textWidth(status) + STATUS_SEPARATOR.length : 0;
}

function withFiller(layout: StatusLineLayout): StatusLineLayout {
  const width =
    busyWidth(layout.busyStatus) +
    textWidth(layout.name) +
    fixedTailWidth(layout.project, layout.labels, layout.modelState);
  return { ...layout, width };
}

export function buildStatusLineLayout(state: StatusLineState, width: number): StatusLineLayout {
  const maxWidth = Math.max(1, width);
  const modelState = formatStatusModel(state.model, state.reasoningEffort, state.provider);
  const busy = state.busyStatus ? truncateEnd(state.busyStatus, Math.min(24, Math.max(1, Math.floor(maxWidth / 3)))) : null;
  let project = state.project;
  let labels = state.labels.slice(0, MAX_STATUS_LABELS).map(visibleLabel);
  let availableNameWidth =
    maxWidth - busyWidth(busy) - fixedTailWidth(project, labels, modelState);

  while (labels.length > 0 && availableNameWidth < 4) {
    labels = labels.slice(0, -1);
    availableNameWidth = maxWidth - busyWidth(busy) - fixedTailWidth(project, labels, modelState);
  }

  if (project && availableNameWidth < 2) {
    project = null;
    availableNameWidth = maxWidth - busyWidth(busy) - fixedTailWidth(project, labels, modelState);
  }

  if (availableNameWidth <= 0) {
    return {
      busyStatus: null,
      fallbackText: truncateEnd(formatStatusLineText(state), maxWidth),
      labels: [],
      modelState: "",
      name: "",
      project: null,
      width: maxWidth
    };
  }

  return withFiller({
    busyStatus: busy,
    fallbackText: null,
    labels,
    modelState,
    name: truncateConversationLabel(state.conversationName, availableNameWidth),
    project,
    width: maxWidth
  });
}

export function StatusLine({
  busyStatus,
  conversationName,
  labels,
  model,
  project,
  provider,
  reasoningEffort,
  theme,
  width
}: StatusLineState & { theme: ResolvedTuiTheme; width: number }): React.ReactElement {
  const layout = buildStatusLineLayout(
    { busyStatus, conversationName, labels, model, project, provider, reasoningEffort },
    width
  );
  const fill = " ".repeat(Math.max(0, width - layout.width));

  if (layout.fallbackText) {
    return (
      <Box width={width}>
        <Text backgroundColor={theme.surface.canvas} color={theme.text.secondary}>
          {layout.fallbackText}
          {" ".repeat(Math.max(0, width - textWidth(layout.fallbackText)))}
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="row" width={width}>
      {layout.busyStatus ? (
        <>
          <Text backgroundColor={theme.surface.canvas} color={theme.status.warn}>
            <Spinner type="dots" /> {layout.busyStatus}
          </Text>
          <Text backgroundColor={theme.surface.canvas} color={theme.text.muted}>
            {STATUS_SEPARATOR}
          </Text>
        </>
      ) : null}
      <Text backgroundColor={theme.surface.canvas} color={theme.text.primary}>
        {layout.name}
      </Text>
      {layout.project ? (
        <>
          <Text backgroundColor={theme.surface.canvas} color={theme.text.muted}>
            {STATUS_SEPARATOR}
          </Text>
          <ProjectBadge project={layout.project} theme={theme} />
        </>
      ) : null}
      {layout.labels.map((label) => (
        <React.Fragment key={label}>
          <Text backgroundColor={theme.surface.canvas} color={theme.text.muted}>
            {STATUS_SEPARATOR}
          </Text>
          <TagBadge label={label} theme={theme} />
        </React.Fragment>
      ))}
      <Text backgroundColor={theme.surface.canvas} color={theme.text.muted}>
        {STATUS_SEPARATOR}
      </Text>
      <Text backgroundColor={theme.surface.canvas} color={theme.text.secondary}>
        {layout.modelState}
      </Text>
      <Text backgroundColor={theme.surface.canvas}>{fill}</Text>
    </Box>
  );
}
