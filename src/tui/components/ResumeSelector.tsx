import React from "react";
import { Box, Text } from "ink";
import type { SessionSummary } from "../../loop/session-store.js";
import type { ResolvedTuiTheme } from "../theme/index.js";
import { ProjectBadge, TagBadge } from "./Badges.js";
import type { OptionSelectorItem } from "./OptionSelector.js";

export type ResumeSelectorFocus = "project" | "label" | "sessions";
export type ResumeSelectorFilterKind = "project" | "label";

export interface ResumeSelectorProps {
  activeFilter: ResumeSelectorFilterKind | null;
  filterFocus: ResumeSelectorFocus;
  filterSelectedIndex: number;
  labelOptions: readonly OptionSelectorItem[];
  projectOptions: readonly OptionSelectorItem[];
  previewIndex?: number;
  selectedIndex: number;
  sessions: readonly SessionSummary[];
  theme: ResolvedTuiTheme;
  width: number;
}

function textLength(value: string): number {
  return Array.from(value).length;
}

function truncate(value: string, maxWidth: number): string {
  if (textLength(value) <= maxWidth) {
    return value;
  }

  if (maxWidth <= 3) {
    return ".".repeat(Math.max(0, maxWidth));
  }

  return `${Array.from(value).slice(0, maxWidth - 3).join("")}...`;
}

function padRight(value: string, width: number): string {
  return `${value}${" ".repeat(Math.max(0, width - textLength(value)))}`;
}

const RESUME_PREVIEW_MIN_ROWS = 7;

export function getResumeSelectorHeight(sessionCount: number, filterExpanded = false, showPreview = false): number {
  return 3 + (filterExpanded ? 1 : 0) + Math.max(1, sessionCount, showPreview ? RESUME_PREVIEW_MIN_ROWS : 1);
}

export function formatResumeActivity(session: Pick<SessionSummary, "messageCount" | "updatedAt">, nowMs = Date.now()): string {
  const updatedAt = Date.parse(session.updatedAt);
  if (!Number.isFinite(updatedAt)) {
    return `${session.messageCount} msgs`;
  }

  const diffMs = Math.max(0, nowMs - updatedAt);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  let age: string;

  if (diffMs < minute) {
    age = "now";
  } else if (diffMs < hour) {
    age = `${Math.floor(diffMs / minute)}m`;
  } else if (diffMs < day) {
    age = `${Math.floor(diffMs / hour)}h`;
  } else if (diffMs < 7 * day) {
    age = `${Math.floor(diffMs / day)}d`;
  } else {
    age = new Date(updatedAt).toISOString().slice(0, 10);
  }

  return `${session.messageCount} msgs · ${age}`;
}

export function formatResumeFilterChipLabel(
  option: OptionSelectorItem,
  kind: ResumeSelectorFilterKind,
  maxWidth = Number.POSITIVE_INFINITY
): string {
  const raw = option.display ?? option.label ?? option.id;
  const display = raw === "全部" ? "all" : raw;
  const label = kind === "label" && option.id !== "__clear_resume_filter__" && !display.startsWith("#") ? `#${display}` : display;
  return Number.isFinite(maxWidth) ? truncate(label, maxWidth) : label;
}

function optionChipWidth(option: OptionSelectorItem, kind: ResumeSelectorFilterKind): number {
  return textLength(formatResumeFilterChipLabel(option, kind, 12)) + 3;
}

function overflowChipWidth(count: number): number {
  return count > 0 ? textLength(` +${count} `) + 1 : 0;
}

export function getVisibleResumeFilterOptions(
  options: readonly OptionSelectorItem[],
  width: number,
  active: boolean,
  selectedIndex = -1,
  kind: ResumeSelectorFilterKind = "project"
): OptionSelectorItem[] {
  const maxWidth = Math.max(0, width - textLength(kind));
  if (options.length === 0 || maxWidth <= 0) {
    return [];
  }

  if (options.reduce((total, option) => total + optionChipWidth(option, kind), 0) <= maxWidth) {
    return [...options];
  }

  const selected = active ? selectedIndex : options.findIndex((option) => option.current);
  const visible: OptionSelectorItem[] = [];
  const visibleIds = new Set<string>();
  const add = (index: number, reserveOverflow = true): boolean => {
    const option = options[index];
    if (!option || visibleIds.has(option.id)) {
      return false;
    }

    const nextHiddenCount = options.length - visible.length - 1;
    const nextWidth =
      visible.reduce((total, item) => total + optionChipWidth(item, kind), 0) +
      optionChipWidth(option, kind) +
      (reserveOverflow ? overflowChipWidth(nextHiddenCount) : 0);
    if (nextWidth > maxWidth) {
      return false;
    }

    visible.push(option);
    visibleIds.add(option.id);
    return true;
  };

  add(0);
  add(selected);
  for (let index = 0; index < options.length; index += 1) {
    add(index);
  }

  return visible.length > 0 ? options.filter((option) => visibleIds.has(option.id)) : [];
}

function FilterChip({
  active,
  current,
  label,
  theme
}: {
  active: boolean;
  current: boolean;
  label: string;
  theme: ResolvedTuiTheme;
}): React.ReactElement {
  return (
    <Text
      backgroundColor={active ? theme.selection.bg : theme.surface.canvas}
      color={active ? theme.selection.fg : current ? theme.accent.default : theme.text.primary}
      underline={current}
    >
      {` ${label} `}
    </Text>
  );
}

function FilterGroup({
  activeFilter,
  focus,
  kind,
  options,
  selectedIndex,
  theme,
  width
}: {
  activeFilter: ResumeSelectorFilterKind | null;
  focus: ResumeSelectorFocus;
  kind: ResumeSelectorFilterKind;
  options: readonly OptionSelectorItem[];
  selectedIndex: number;
  theme: ResolvedTuiTheme;
  width: number;
}): React.ReactElement {
  const isActiveFilter = activeFilter === kind;
  const isFocused = focus === kind || isActiveFilter;
  const visibleOptions = getVisibleResumeFilterOptions(options, width, isActiveFilter, selectedIndex, kind);
  const overflow = Math.max(0, options.length - visibleOptions.length);
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : null;
  const usedWidth =
    textLength(kind) +
    visibleOptions.reduce((total, option) => total + optionChipWidth(option, kind), 0) +
    overflowChipWidth(overflow);
  const fill = " ".repeat(Math.max(0, width - usedWidth));

  return (
    <Box flexDirection="row" overflow="hidden" width={width}>
      <Text backgroundColor={theme.surface.canvas} color={isFocused ? theme.accent.default : theme.text.muted}>
        {kind}
      </Text>
      {visibleOptions.map((option) => (
        <React.Fragment key={option.id}>
          <Text backgroundColor={theme.surface.canvas}> </Text>
          <FilterChip
            active={isActiveFilter && option.id === selectedOption?.id}
            current={option.current}
            label={formatResumeFilterChipLabel(option, kind, 12)}
            theme={theme}
          />
        </React.Fragment>
      ))}
      {overflow > 0 ? (
        <>
          <Text backgroundColor={theme.surface.canvas}> </Text>
          <FilterChip active={false} current={false} label={`+${overflow}`} theme={theme} />
        </>
      ) : null}
      <Text backgroundColor={theme.surface.canvas}>{fill}</Text>
    </Box>
  );
}

function FilterChoices({
  kind,
  options,
  selectedIndex,
  theme,
  width
}: {
  kind: ResumeSelectorFilterKind;
  options: readonly OptionSelectorItem[];
  selectedIndex: number;
  theme: ResolvedTuiTheme;
  width: number;
}): React.ReactElement {
  const visibleOptions = getVisibleResumeFilterOptions(options, width - 10, true, selectedIndex, kind);
  const overflow = Math.max(0, options.length - visibleOptions.length);
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : null;

  return (
    <Box flexDirection="row" paddingX={1} width={width}>
      <Text backgroundColor={theme.surface.canvas} color={theme.text.faint}>
        {"filter › "}
      </Text>
      <Text backgroundColor={theme.surface.canvas} color={theme.accent.default}>
        {kind}
      </Text>
      {visibleOptions.map((option) => (
        <React.Fragment key={option.id}>
          <Text backgroundColor={theme.surface.canvas}> </Text>
          <FilterChip
            active={option.id === selectedOption?.id}
            current={option.current}
            label={formatResumeFilterChipLabel(option, kind, 12)}
            theme={theme}
          />
        </React.Fragment>
      ))}
      {overflow > 0 ? (
        <Text backgroundColor={theme.surface.canvas} color={theme.text.muted}>
          {` +${overflow}`}
        </Text>
      ) : null}
    </Box>
  );
}

function ResumeHeader({ theme, width }: { theme: ResolvedTuiTheme; width: number }): React.ReactElement {
  const modelWidth = width >= 76 ? 18 : 12;
  const labelsWidth = width >= 88 ? 26 : 16;
  const activityWidth = width >= 82 ? 18 : 12;
  const sessionWidth = Math.max(12, width - modelWidth - labelsWidth - activityWidth - 7);

  return (
    <Box flexDirection="row" paddingX={1} width={width}>
      <Text backgroundColor={theme.surface.canvas} color={theme.text.faint}>
        {"  "}
      </Text>
      <Text backgroundColor={theme.surface.canvas} color={theme.text.muted}>
        {padRight("session", sessionWidth)}
      </Text>
      <Text backgroundColor={theme.surface.canvas} color={theme.text.muted}>
        {padRight("model", modelWidth)}
      </Text>
      <Text backgroundColor={theme.surface.canvas} color={theme.text.muted}>
        {padRight("labels", labelsWidth)}
      </Text>
      <Text backgroundColor={theme.surface.canvas} color={theme.text.muted}>
        {truncate("last active", activityWidth)}
      </Text>
    </Box>
  );
}

function getResumeFilterTitle(width: number): string {
  return width < 34 ? "resume" : "resume session";
}

export function getResumeFilterGroupWidths(width: number): { project: number; label: number } {
  const innerWidth = Math.max(1, width - 2);
  const fixedWidth = textLength(getResumeFilterTitle(width)) + textLength(" │ ") * 2;
  const available = Math.max(textLength("project") + textLength("label"), innerWidth - fixedWidth);
  const project = Math.max(textLength("project"), Math.floor(available / 2));
  const label = Math.max(textLength("label"), available - project);
  return { project, label };
}

function ResumeRow({
  index,
  selected,
  session,
  theme,
  width
}: {
  index: number;
  selected: boolean;
  session: SessionSummary;
  theme: ResolvedTuiTheme;
  width: number;
}): React.ReactElement {
  const modelWidth = width >= 76 ? 18 : 12;
  const labelsWidth = width >= 88 ? 26 : 16;
  const activityWidth = width >= 82 ? 18 : 12;
  const sessionWidth = Math.max(12, width - modelWidth - labelsWidth - activityWidth - 7);
  const labelLimit = labelsWidth >= 24 ? 2 : 1;
  const visibleLabels = session.labels.slice(0, labelLimit);
  const hiddenLabelCount = Math.max(0, session.labels.length - visibleLabels.length);
  const rowBg = selected ? theme.selection.bg : theme.surface.canvas;
  const rowFg = selected ? theme.selection.fg : theme.text.primary;
  const projectWidth = session.project ? Math.min(12, session.project.length) + 2 : 0;
  const nameWidth = Math.max(8, sessionWidth - projectWidth - 1);
  const model = truncate(session.model ?? "-", modelWidth - 1);
  const activity = truncate(formatResumeActivity(session), activityWidth);

  return (
    <Box flexDirection="row" paddingX={1} width={width}>
      <Text backgroundColor={rowBg} color={selected ? theme.accent.default : theme.text.faint}>
        {selected ? "› " : index < 9 ? `${index + 1} ` : "  "}
      </Text>
      <Box flexDirection="row" width={sessionWidth}>
        <Text backgroundColor={rowBg} bold={selected} color={rowFg}>
          {padRight(truncate(session.name, nameWidth), nameWidth)}
        </Text>
        {session.project ? (
          <>
            <Text backgroundColor={rowBg}> </Text>
            <ProjectBadge project={truncate(session.project, Math.max(1, projectWidth - 2))} theme={theme} />
          </>
        ) : null}
      </Box>
      <Text backgroundColor={rowBg} color={theme.text.muted}>
        {padRight(model, modelWidth)}
      </Text>
      <Box flexDirection="row" width={labelsWidth}>
        {visibleLabels.length === 0 ? (
          <Text backgroundColor={rowBg} color={theme.text.faint}>
            {padRight("-", labelsWidth)}
          </Text>
        ) : (
          <>
            {visibleLabels.map((label) => (
              <React.Fragment key={label}>
                <TagBadge label={label} theme={theme} />
                <Text backgroundColor={rowBg}> </Text>
              </React.Fragment>
            ))}
            {hiddenLabelCount > 0 ? (
              <Text backgroundColor={rowBg} color={theme.text.muted}>
                {`+${hiddenLabelCount}`}
              </Text>
            ) : null}
          </>
        )}
      </Box>
      <Text backgroundColor={rowBg} color={theme.text.muted}>
        {activity}
      </Text>
    </Box>
  );
}

function formatResumeTokenCount(tokens: number | undefined): string {
  const value = Math.max(0, tokens ?? 0);
  if (value >= 1000) {
    const scaled = value / 1000;
    return `${scaled >= 100 ? Math.round(scaled) : scaled.toFixed(1)}K`;
  }
  return String(value);
}

export function formatResumePreviewText(session: Pick<SessionSummary, "lastAssistantMessage">, width: number): string {
  const source = session.lastAssistantMessage?.replace(/\s+/gu, " ").trim() || "No assistant reply yet.";
  return truncate(source, Math.max(1, width));
}

function ResumePreviewPane({
  session,
  theme,
  width
}: {
  session: SessionSummary | undefined;
  theme: ResolvedTuiTheme;
  width: number;
}): React.ReactElement {
  const innerWidth = Math.max(1, width - 2);
  if (!session) {
    return (
      <Box borderColor={theme.border.subtle} borderStyle="single" flexDirection="column" width={width}>
        <Text backgroundColor={theme.surface.canvas} color={theme.text.faint}>
          No session selected.
        </Text>
      </Box>
    );
  }

  const meta = [
    `model ${session.model ?? "-"}`,
    `${session.messageCount} msgs`,
    `ctx ${formatResumeTokenCount(session.contextTokens)}`,
    formatResumeActivity(session)
  ];
  const preview = formatResumePreviewText(session, innerWidth);
  const previewFill = " ".repeat(Math.max(0, innerWidth - textLength(preview)));

  return (
    <Box borderColor={theme.border.subtle} borderStyle="single" flexDirection="column" width={width}>
      <Text backgroundColor={theme.surface.canvas} color={theme.text.muted}>
        preview
      </Text>
      <Text backgroundColor={theme.surface.canvas} color={theme.text.primary}>
        {preview}
        {previewFill}
      </Text>
      <Text backgroundColor={theme.surface.canvas} color={theme.text.faint}>
        {"─".repeat(innerWidth)}
      </Text>
      {meta.map((line) => {
        const visible = truncate(line, innerWidth);
        const fill = " ".repeat(Math.max(0, innerWidth - textLength(visible)));
        return (
          <Text key={line} backgroundColor={theme.surface.canvas} color={theme.text.muted}>
            {visible}
            {fill}
          </Text>
        );
      })}
    </Box>
  );
}

export function ResumeSelector({
  activeFilter,
  filterFocus,
  filterSelectedIndex,
  labelOptions,
  previewIndex,
  projectOptions,
  selectedIndex,
  sessions,
  theme,
  width
}: ResumeSelectorProps): React.ReactElement {
  const activeOptions = activeFilter === "project" ? projectOptions : activeFilter === "label" ? labelOptions : [];
  const groupWidths = getResumeFilterGroupWidths(width);
  const filterTitle = getResumeFilterTitle(width);
  const showPreview = width >= 104 && sessions.length > 0;
  const height = getResumeSelectorHeight(sessions.length, activeFilter !== null, showPreview);
  const previewWidth = showPreview ? Math.min(36, Math.max(28, Math.floor(width * 0.34))) : 0;
  const listWidth = showPreview ? Math.max(1, width - previewWidth - 1) : width;
  const selectedPreviewIndex = Math.max(0, Math.min(previewIndex ?? selectedIndex, sessions.length - 1));
  const selectedPreviewSession = sessions[selectedPreviewIndex];

  return (
    <Box flexDirection="column" flexShrink={0} height={height} width={width}>
      <Box flexDirection="row" height={1} paddingX={1} width={width}>
        <Text backgroundColor={theme.surface.canvas} color={filterFocus === "sessions" ? theme.accent.default : theme.text.muted}>
          {filterTitle}
        </Text>
        <Text backgroundColor={theme.surface.canvas} color={theme.text.faint}>
          {" │ "}
        </Text>
        <FilterGroup
          activeFilter={activeFilter}
          focus={filterFocus}
          kind="project"
          options={projectOptions}
          selectedIndex={activeFilter === "project" ? filterSelectedIndex : -1}
          theme={theme}
          width={groupWidths.project}
        />
        <Text backgroundColor={theme.surface.canvas} color={theme.text.faint}>
          {" │ "}
        </Text>
        <FilterGroup
          activeFilter={activeFilter}
          focus={filterFocus}
          kind="label"
          options={labelOptions}
          selectedIndex={activeFilter === "label" ? filterSelectedIndex : -1}
          theme={theme}
          width={groupWidths.label}
        />
      </Box>
      {activeFilter ? (
        <FilterChoices
          kind={activeFilter}
          options={activeOptions}
          selectedIndex={filterSelectedIndex}
          theme={theme}
          width={width}
        />
      ) : null}
      <Text backgroundColor={theme.surface.canvas} color={theme.border.subtle}>
        {"─".repeat(Math.max(1, width))}
      </Text>
      <Box flexDirection="row" width={width}>
        <Box flexDirection="column" width={listWidth}>
          <ResumeHeader theme={theme} width={listWidth} />
          {sessions.length === 0 ? (
            <Box paddingX={1} width={listWidth}>
              <Text backgroundColor={theme.surface.canvas} color={theme.status.warn}>
                无匹配会话
              </Text>
            </Box>
          ) : (
            sessions.map((session, index) => (
              <ResumeRow
                key={session.id}
                index={index}
                selected={filterFocus === "sessions" && index === selectedIndex}
                session={session}
                theme={theme}
                width={listWidth}
              />
            ))
          )}
        </Box>
        {showPreview ? (
          <>
            <Text backgroundColor={theme.surface.canvas} color={theme.border.subtle}>
              │
            </Text>
            <ResumePreviewPane session={selectedPreviewSession} theme={theme} width={previewWidth} />
          </>
        ) : null}
      </Box>
    </Box>
  );
}
