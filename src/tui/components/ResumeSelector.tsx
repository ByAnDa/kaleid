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

export function getResumeSelectorHeight(sessionCount: number, filterExpanded = false): number {
  return 3 + (filterExpanded ? 1 : 0) + Math.max(1, sessionCount);
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

export function formatResumeFilterChipLabel(option: OptionSelectorItem, kind: ResumeSelectorFilterKind): string {
  const raw = option.display ?? option.label ?? option.id;
  const display = raw === "全部" ? "all" : raw;
  if (kind === "label" && option.id !== "__clear_resume_filter__" && !display.startsWith("#")) {
    return `#${display}`;
  }
  return display;
}

function chipLimit(width: number, active: boolean): number {
  if (active) {
    return width >= 72 ? 8 : 5;
  }
  if (width >= 100) {
    return 5;
  }
  if (width >= 76) {
    return 4;
  }
  return 2;
}

export function getVisibleResumeFilterOptions(
  options: readonly OptionSelectorItem[],
  width: number,
  active: boolean,
  selectedIndex = -1
): OptionSelectorItem[] {
  const limit = Math.min(options.length, chipLimit(width, active));
  if (limit >= options.length) {
    return [...options];
  }

  const selected = active ? selectedIndex : options.findIndex((option) => option.current);
  const keepIds = new Set<string>();
  const add = (index: number): void => {
    const option = options[index];
    if (option && keepIds.size < limit) {
      keepIds.add(option.id);
    }
  };

  add(0);
  add(selected);
  for (let index = 0; index < options.length && keepIds.size < limit; index += 1) {
    add(index);
  }

  return options.filter((option) => keepIds.has(option.id));
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
  const visibleOptions = getVisibleResumeFilterOptions(options, width, isActiveFilter, selectedIndex);
  const overflow = Math.max(0, options.length - visibleOptions.length);
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : null;

  return (
    <>
      <Text backgroundColor={theme.surface.canvas} color={isFocused ? theme.accent.default : theme.text.muted}>
        {kind}
      </Text>
      {visibleOptions.map((option) => (
        <React.Fragment key={option.id}>
          <Text backgroundColor={theme.surface.canvas}> </Text>
          <FilterChip
            active={isActiveFilter && option.id === selectedOption?.id}
            current={option.current}
            label={formatResumeFilterChipLabel(option, kind)}
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
    </>
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
  const visibleOptions = getVisibleResumeFilterOptions(options, width, true, selectedIndex);
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
            label={formatResumeFilterChipLabel(option, kind)}
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

export function ResumeSelector({
  activeFilter,
  filterFocus,
  filterSelectedIndex,
  labelOptions,
  projectOptions,
  selectedIndex,
  sessions,
  theme,
  width
}: ResumeSelectorProps): React.ReactElement {
  const activeOptions = activeFilter === "project" ? projectOptions : activeFilter === "label" ? labelOptions : [];
  const height = getResumeSelectorHeight(sessions.length, activeFilter !== null);

  return (
    <Box flexDirection="column" flexShrink={0} height={height} width={width}>
      <Box flexDirection="row" height={1} overflow="hidden" paddingX={1} width={width}>
        <Text backgroundColor={theme.surface.canvas} color={filterFocus === "sessions" ? theme.accent.default : theme.text.muted}>
          resume session
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
          width={width}
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
          width={width}
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
      <ResumeHeader theme={theme} width={width} />
      {sessions.length === 0 ? (
        <Box paddingX={1} width={width}>
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
            width={width}
          />
        ))
      )}
    </Box>
  );
}
