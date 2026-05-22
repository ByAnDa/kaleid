import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, Text, useApp, useInput } from "ink";
import { saveApiKey, type ApiKeyProviderId } from "../auth/config-store.js";
import type { runTurn as runTurnFn } from "../loop/agent-loop.js";
import { buildSystemPrompt } from "../loop/system-prompt.js";
import { createSession, type Session, type TokenState } from "../loop/session.js";
import {
  DEFAULT_SESSION_LABEL_LIMIT,
  filterSessions,
  formatSessionDisplayName,
  listSessionMetadataOptions,
  listSessions,
  loadSessionData,
  normalizeSessionLabel,
  normalizeSessionLabels,
  normalizeSessionProject,
  type SessionMetadataOptions,
  type SessionMetadata,
  type SessionSummary
} from "../loop/session-store.js";
import {
  DEFAULT_REASONING_EFFORT,
  REASONING_LEVELS,
  getProviderForModel,
  getModelOptions,
  isReasoningEffort,
  providerLabel,
  providerSupportsReasoningEffort,
  type AvailableModel,
  type ProviderId,
  type ReasoningEffort
} from "../provider/models.js";
import { createProviderForModel, getAuthenticatedModels } from "../provider/registry.js";
import type { LLMProvider } from "../provider/types.js";
import type { Tool } from "../tools/types.js";
import {
  getSlashCommandCompletions,
  parseChatLabelCommandArgs,
  parseProjectCommandArgs,
  parseRenameCommandArgs,
  parseSlash,
  runSlashCommand,
  type RenameCommandArgs,
  type SlashCommandDefinition
} from "./commands.js";
import { Conversation } from "./components/Conversation.js";
import { Header, HEADER_HEIGHT } from "./components/Header.js";
import { InputBar, getInputBarHeight } from "./components/InputBar.js";
import {
  OptionSelector,
  getOptionSelectorHeight,
  type OptionSelectorItem
} from "./components/OptionSelector.js";
import {
  OptionCombobox,
  getOptionComboboxHeight,
  isOptionComboboxTyping,
  type OptionComboboxItem
} from "./components/OptionCombobox.js";
import { getTerminalDimensions, type TerminalDimensions } from "./terminal.js";
import type { Msg } from "./types.js";
import {
  DEFAULT_THEME_MODE,
  detectTerminalAppearance,
  detectTerminalColorLevel,
  getResolvedTheme,
  themeNameForMode,
  type ResolvedTuiTheme,
  type ThemeMode
} from "./theme/index.js";
import { ProjectBadge, TagBadge } from "./components/Badges.js";

export interface AppProps {
  model: string;
  cwd: string;
  session: Session;
  provider?: LLMProvider;
  loadAvailableModels?: () => Promise<AvailableModel[]>;
  resolveProvider?: (model: string, models: AvailableModel[]) => Promise<LLMProvider>;
  tools: Tool[];
  runTurn: typeof runTurnFn;
  openResumeSelectorOnStart?: boolean;
}

function summarize(text: string): string {
  return (text.split(/\r?\n/u)[0] ?? "").slice(0, 160);
}

function nextId(): string {
  return crypto.randomUUID();
}

function messagesToHistory(messages: Session["messages"]): Msg[] {
  return messages
    .filter((message) => message.content.length > 0 || message.role === "tool")
    .map((message) => ({
      id: nextId(),
      role: message.role === "tool" ? "tool" : message.role,
      text: message.content,
      ...(message.role === "tool"
        ? {
            tool: {
              name: "tool",
              args: message.toolCallId ? { toolCallId: message.toolCallId } : {},
              resultSummary: summarize(message.content),
              isError: false
            }
          }
        : {})
    }));
}

export function resumeToOption(session: SessionSummary): OptionSelectorItem {
  const model = session.model ? ` · ${session.model}` : "";
  return {
    id: session.id,
    display: `${session.label}${model}`,
    current: false
  };
}

export interface ResumeFilterState {
  project: string | null;
  label: string | null;
}

export type ResumeFilterFocus = "project" | "label" | "sessions";
export type SelectorKind =
  | "model"
  | "reasoning"
  | "login"
  | "resume"
  | "resumeProjectFilter"
  | "resumeLabelFilter"
  | "theme";
export type SelectorFlow = "standalone" | "modelEffortChain";
export type ComboboxKind = "project" | "chatlabel";
export type RenameSlashAction =
  | { kind: "input"; initialValue: string }
  | { kind: "rename"; rename: RenameCommandArgs }
  | { kind: "invalid" };

export const CLEAR_PROJECT_OPTION_ID = "__clear_project__";
export const CLEAR_RESUME_FILTER_OPTION_ID = "__clear_resume_filter__";
export const EMPTY_RESUME_OPTION_ID = "__empty_resume__";
export const RENAME_INPUT_PROMPT = "输入对话名称（可 项目/名称）：";

const DEFAULT_RESUME_FILTER: ResumeFilterState = { project: null, label: null };
const EMPTY_SESSION_METADATA_OPTIONS: SessionMetadataOptions = { projects: [], labels: [] };
const THEME_OPTION_LABELS: Record<ThemeMode, string> = {
  system: "跟随终端",
  daylight: "Daylight",
  spectrum: "Spectrum"
};

export interface SelectorTransitionInput {
  activeSelector: SelectorKind;
  selectorFlow: SelectorFlow;
  selectedId: string;
  selectedProvider?: ProviderId;
  currentModel: string;
  reasoningEffort: ReasoningEffort;
}

export interface SelectorCancelInput {
  activeSelector: SelectorKind;
  selectorFlow: SelectorFlow;
  currentModel: string;
  reasoningEffort: ReasoningEffort;
}

export interface SelectorTransition {
  currentModel: string;
  reasoningEffort: ReasoningEffort;
  nextSelector: SelectorKind | null;
  nextSelectorFlow: SelectorFlow;
  message: string | null;
}

function moveSelection(current: number, direction: -1 | 1, count: number): number {
  if (count <= 0) {
    return 0;
  }

  return (current + direction + count) % count;
}

function getCurrentIndex(options: OptionSelectorItem[]): number {
  const currentIndex = options.findIndex((option) => option.current);
  return currentIndex >= 0 ? currentIndex : 0;
}

export function resolveSlashEnterSubmission(
  input: string,
  slashCandidates: SlashCommandDefinition[],
  selectedSlashIndex: number
): string {
  return slashCandidates[selectedSlashIndex]?.command ?? input;
}

function modelToOption(currentModel: string, model: AvailableModel): OptionSelectorItem {
  return {
    id: model.id,
    label: model.label,
    provider: model.provider,
    current: model.id === currentModel
  };
}

function buildModelOptions(currentModel: string, models: AvailableModel[]): OptionSelectorItem[] {
  const options = models.length > 0 ? models : getModelOptions(currentModel, models);
  return options.map((model) => modelToOption(currentModel, model));
}

function formatInputConversationLabel(metadata: Pick<SessionMetadata, "project" | "name" | "labels">): string {
  return formatSessionDisplayName(metadata.project, metadata.name, metadata.labels, {
    maxLabels: DEFAULT_SESSION_LABEL_LIMIT
  });
}

export function buildProjectComboboxOptions(
  projects: readonly string[],
  currentProject: string | null | undefined
): OptionComboboxItem[] {
  const normalizedCurrentProject = normalizeSessionProject(currentProject);
  const projectSet = new Set<string>();
  for (const project of projects) {
    const normalizedProject = normalizeSessionProject(project);
    if (normalizedProject) {
      projectSet.add(normalizedProject);
    }
  }
  if (normalizedCurrentProject) {
    projectSet.add(normalizedCurrentProject);
  }

  return [
    {
      id: CLEAR_PROJECT_OPTION_ID,
      display: "(无项目)",
      current: normalizedCurrentProject === null
    },
    ...[...projectSet].sort((a, b) => a.localeCompare(b)).map((project) => ({
      id: project,
      current: project === normalizedCurrentProject
    }))
  ];
}

export function buildChatLabelComboboxOptions(
  labels: readonly string[],
  currentLabels: readonly string[]
): OptionComboboxItem[] {
  const currentLabelSet = new Set(normalizeSessionLabels(currentLabels));
  const labelSet = new Set([...normalizeSessionLabels(labels), ...currentLabelSet]);
  return [...labelSet].sort((a, b) => a.localeCompare(b)).map((label) => ({
    id: label,
    current: currentLabelSet.has(label)
  }));
}

export function formatResumeFilterValue(value: string | null | undefined): string {
  return value ?? "全部";
}

export function buildResumeProjectFilterOptions(
  projects: readonly string[],
  currentProject: string | null | undefined
): OptionSelectorItem[] {
  const normalizedCurrentProject = normalizeSessionProject(currentProject);
  const projectSet = new Set<string>();
  for (const project of projects) {
    const normalizedProject = normalizeSessionProject(project);
    if (normalizedProject) {
      projectSet.add(normalizedProject);
    }
  }
  if (normalizedCurrentProject) {
    projectSet.add(normalizedCurrentProject);
  }

  return [
    {
      id: CLEAR_RESUME_FILTER_OPTION_ID,
      display: "全部",
      current: normalizedCurrentProject === null
    },
    ...[...projectSet].sort((a, b) => a.localeCompare(b)).map((project) => ({
      id: project,
      current: project === normalizedCurrentProject
    }))
  ];
}

export function buildResumeLabelFilterOptions(
  labels: readonly string[],
  currentLabel: string | null | undefined
): OptionSelectorItem[] {
  const normalizedCurrentLabel = normalizeSessionLabel(currentLabel);
  const labelSet = new Set(normalizeSessionLabels(labels));
  if (normalizedCurrentLabel) {
    labelSet.add(normalizedCurrentLabel);
  }

  return [
    {
      id: CLEAR_RESUME_FILTER_OPTION_ID,
      display: "全部",
      current: normalizedCurrentLabel === null
    },
    ...[...labelSet].sort((a, b) => a.localeCompare(b)).map((label) => ({
      id: label,
      current: label === normalizedCurrentLabel
    }))
  ];
}

export function buildResumeSelectorOptions(
  sessions: readonly SessionSummary[],
  filter: ResumeFilterState
): OptionSelectorItem[] {
  const options = filterSessions(sessions, filter).map(resumeToOption);
  if (options.length > 0) {
    return options;
  }

  return [
    {
      id: EMPTY_RESUME_OPTION_ID,
      display: "无匹配会话",
      current: false,
      disabled: true
    }
  ];
}

export function resolveComboboxSubmission(
  input: string,
  options: readonly OptionComboboxItem[],
  selectedIndex: number
): string | null {
  if (input.trim().length > 0) {
    return input;
  }

  return options[selectedIndex]?.id ?? null;
}

export function getRenameInputPrefill(metadata: Pick<SessionMetadata, "name">): string {
  return metadata.name;
}

export function parseRenameInputValue(input: string): RenameCommandArgs | null {
  return parseRenameCommandArgs([input]);
}

export function resolveRenameSlashAction(args: readonly string[], currentName: string): RenameSlashAction {
  const rename = parseRenameCommandArgs([...args]);
  if (rename) {
    return { kind: "rename", rename };
  }

  if (args.length === 0) {
    return { kind: "input", initialValue: currentName };
  }

  return { kind: "invalid" };
}

const LOGIN_OPTIONS: OptionSelectorItem[] = [
  { id: "openai-codex", label: "OpenAI Codex OAuth", provider: "openai-codex", current: false },
  { id: "deepseek", label: "DeepSeek API key", provider: "deepseek", current: false },
  { id: "kimi", label: "Kimi coding API key", provider: "kimi", current: false }
];

export function applySelectorTransition(input: SelectorTransitionInput): SelectorTransition {
  if (input.activeSelector === "model") {
    const supportsEffort = providerSupportsReasoningEffort(input.selectedProvider);
    const shouldSelectEffort = input.selectorFlow === "modelEffortChain" && supportsEffort;
    const modelLabel = input.selectedProvider ? `${input.selectedId} ${providerLabel(input.selectedProvider)}` : input.selectedId;
    return {
      currentModel: input.selectedId,
      reasoningEffort: input.reasoningEffort,
      nextSelector: shouldSelectEffort ? "reasoning" : null,
      nextSelectorFlow: shouldSelectEffort ? "modelEffortChain" : "standalone",
      message: shouldSelectEffort
        ? null
        : supportsEffort
          ? `已切换模型: ${modelLabel}`
          : `已设置模型: ${modelLabel}; 推理强度 N/A`
    };
  }

  if (isReasoningEffort(input.selectedId)) {
    return {
      currentModel: input.currentModel,
      reasoningEffort: input.selectedId,
      nextSelector: null,
      nextSelectorFlow: "standalone",
      message:
        input.selectorFlow === "modelEffortChain"
          ? `已设置: ${input.currentModel} · ${input.selectedId}`
          : `已切换推理强度: ${input.selectedId}`
    };
  }

  return {
    currentModel: input.currentModel,
    reasoningEffort: input.reasoningEffort,
    nextSelector: null,
    nextSelectorFlow: "standalone",
    message: null
  };
}

export function cancelSelectorTransition(input: SelectorCancelInput): SelectorTransition {
  if (input.activeSelector === "reasoning" && input.selectorFlow === "modelEffortChain") {
    return {
      currentModel: input.currentModel,
      reasoningEffort: input.reasoningEffort,
      nextSelector: null,
      nextSelectorFlow: "standalone",
      message: `已设置模型: ${input.currentModel}; 推理强度保持 ${input.reasoningEffort}`
    };
  }

  return {
    currentModel: input.currentModel,
    reasoningEffort: input.reasoningEffort,
    nextSelector: null,
    nextSelectorFlow: "standalone",
    message:
      input.activeSelector === "model"
        ? "已取消模型选择"
        : input.activeSelector === "login"
          ? "已取消登录"
          : input.activeSelector === "resume"
            ? "已取消恢复会话"
            : input.activeSelector === "resumeProjectFilter"
              ? "已取消项目筛选"
              : input.activeSelector === "resumeLabelFilter"
                ? "已取消标签筛选"
                : input.activeSelector === "theme"
                  ? "已取消主题选择"
                  : "已取消推理强度选择"
  };
}

function useTerminalDimensions(): TerminalDimensions {
  const [dimensions, setDimensions] = useState<TerminalDimensions>(() => getTerminalDimensions());

  useEffect(() => {
    const updateDimensions = () => {
      setDimensions(getTerminalDimensions());
    };

    process.stdout.on("resize", updateDimensions);
    updateDimensions();

    return () => {
      process.stdout.off("resize", updateDimensions);
    };
  }, []);

  return dimensions;
}

interface ResumeFilterBarProps {
  filter: ResumeFilterState;
  focus: ResumeFilterFocus;
  theme: ResolvedTuiTheme;
  width: number;
}

function ResumeFilterBar({ filter, focus, theme, width }: ResumeFilterBarProps): React.ReactElement {
  const renderFilter = (kind: Exclude<ResumeFilterFocus, "sessions">, label: string, value: string | null) => {
    const selected = focus === kind;
    const text = `${label}: ${formatResumeFilterValue(value)}`;
    return (
      <>
        <Text
          backgroundColor={selected ? theme.selection.bg : theme.surface.panel}
          color={selected ? theme.selection.fg : theme.accent.primary}
        >
          {text}
        </Text>
        {value ? (
          <>
            <Text backgroundColor={theme.surface.panel}> </Text>
            {kind === "project" ? (
              <ProjectBadge project={value} theme={theme} />
            ) : (
              <TagBadge label={value} theme={theme} />
            )}
          </>
        ) : null}
      </>
    );
  };

  return (
    <Box flexShrink={0} paddingX={1} width={width}>
      {renderFilter("project", "project", filter.project)}
      <Text backgroundColor={theme.surface.panel}>  </Text>
      {renderFilter("label", "label", filter.label)}
    </Box>
  );
}

export function App({
  model,
  cwd,
  session,
  provider,
  loadAvailableModels = getAuthenticatedModels,
  resolveProvider = createProviderForModel,
  tools,
  runTurn,
  openResumeSelectorOnStart = false
}: AppProps): React.ReactElement {
  const { exit } = useApp();
  const terminal = useTerminalDimensions();
  const [currentSession, setCurrentSession] = useState(session);
  const [conversationLabel, setConversationLabel] = useState(() => formatInputConversationLabel(session.metadata));
  const [themeMode, setThemeMode] = useState<ThemeMode>(DEFAULT_THEME_MODE);
  const [terminalAppearance] = useState(() => detectTerminalAppearance());
  const [terminalColorLevel] = useState(() => detectTerminalColorLevel());
  const [currentModel, setCurrentModel] = useState(session.metadata.model ?? model);
  const [availableModels, setAvailableModels] = useState<AvailableModel[]>([]);
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort>(
    session.metadata.reasoningEffort ?? DEFAULT_REASONING_EFFORT
  );
  const [history, setHistory] = useState<Msg[]>(() => messagesToHistory(session.messages));
  const [tokenState, setTokenState] = useState<TokenState>(() => session.getTokenState(session.metadata.model ?? model));
  const [streaming, setStreaming] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [manualInputMask, setManualInputMask] = useState<string | undefined>(undefined);
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [slashMenuIndex, setSlashMenuIndex] = useState(0);
  const [activeSelector, setActiveSelector] = useState<SelectorKind | null>(null);
  const [selectorFlow, setSelectorFlow] = useState<SelectorFlow>("standalone");
  const [selectorIndex, setSelectorIndex] = useState(0);
  const [resumeSessions, setResumeSessions] = useState<SessionSummary[]>([]);
  const [resumeMetadataOptions, setResumeMetadataOptions] = useState<SessionMetadataOptions>(
    EMPTY_SESSION_METADATA_OPTIONS
  );
  const [resumeFilter, setResumeFilter] = useState<ResumeFilterState>(DEFAULT_RESUME_FILTER);
  const [resumeFocus, setResumeFocus] = useState<ResumeFilterFocus>("sessions");
  const [activeCombobox, setActiveCombobox] = useState<ComboboxKind | null>(null);
  const [comboboxOptions, setComboboxOptions] = useState<OptionComboboxItem[]>([]);
  const [comboboxIndex, setComboboxIndex] = useState(0);
  const [comboboxInput, setComboboxInput] = useState("");
  const [renameInputActive, setRenameInputActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [manualCodePrompt, setManualCodePrompt] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const manualCodeRef = useRef<{ resolve: (value: string) => void; reject: (error: Error) => void } | null>(null);
  const slashCompletions = useMemo(() => getSlashCommandCompletions(input), [input]);
  const theme = useMemo(
    () => getResolvedTheme(themeMode, terminalAppearance, terminalColorLevel),
    [terminalAppearance, terminalColorLevel, themeMode]
  );
  const slashCandidates = slashCompletions ?? [];
  const slashMenuVisible =
    !busy &&
    !manualCodePrompt &&
    !activeSelector &&
    !activeCombobox &&
    !renameInputActive &&
    slashMenuOpen &&
    slashCompletions !== null;
  const selectedSlashIndex = slashCandidates.length === 0 ? -1 : Math.min(slashMenuIndex, slashCandidates.length - 1);
  const currentProvider = useMemo(
    () => getProviderForModel(currentModel, availableModels),
    [availableModels, currentModel]
  );
  const modelOptions = useMemo<OptionSelectorItem[]>(
    () => buildModelOptions(currentModel, availableModels),
    [availableModels, currentModel]
  );
  const reasoningOptions = useMemo<OptionSelectorItem[]>(
    () =>
      REASONING_LEVELS.map((level) => ({
        id: level,
        current: level === reasoningEffort
      })),
    [reasoningEffort]
  );
  const themeOptions = useMemo<OptionSelectorItem[]>(
    () =>
      (Object.keys(THEME_OPTION_LABELS) as ThemeMode[]).map((mode) => ({
        id: mode,
        display:
          mode === "system"
            ? `${THEME_OPTION_LABELS[mode]} (${themeNameForMode(mode, terminalAppearance)})`
            : THEME_OPTION_LABELS[mode],
        current: mode === themeMode
      })),
    [terminalAppearance, themeMode]
  );
  const resumeOptions = useMemo<OptionSelectorItem[]>(
    () => buildResumeSelectorOptions(resumeSessions, resumeFilter),
    [resumeFilter, resumeSessions]
  );
  const resumeProjectFilterOptions = useMemo<OptionSelectorItem[]>(
    () => buildResumeProjectFilterOptions(resumeMetadataOptions.projects, resumeFilter.project),
    [resumeFilter.project, resumeMetadataOptions.projects]
  );
  const resumeLabelFilterOptions = useMemo<OptionSelectorItem[]>(
    () => buildResumeLabelFilterOptions(resumeMetadataOptions.labels, resumeFilter.label),
    [resumeFilter.label, resumeMetadataOptions.labels]
  );
  const selectorOptions =
    activeSelector === "model"
      ? modelOptions
      : activeSelector === "reasoning"
        ? reasoningOptions
        : activeSelector === "login"
          ? LOGIN_OPTIONS
          : activeSelector === "theme"
            ? themeOptions
            : activeSelector === "resume"
              ? resumeOptions
              : activeSelector === "resumeProjectFilter"
                ? resumeProjectFilterOptions
                : activeSelector === "resumeLabelFilter"
                  ? resumeLabelFilterOptions
                  : [];
  const selectedSelectorIndex =
    selectorOptions.length === 0 ? -1 : Math.min(selectorIndex, selectorOptions.length - 1);
  const selectorVisible = activeSelector !== null;
  const selectorHeight = selectorVisible ? getOptionSelectorHeight(selectorOptions.length) : 0;
  const comboboxVisible = activeCombobox !== null;
  const selectedComboboxIndex =
    comboboxOptions.length === 0 ? -1 : Math.min(comboboxIndex, comboboxOptions.length - 1);
  const comboboxHeight = comboboxVisible ? getOptionComboboxHeight(comboboxOptions.length, comboboxInput) : 0;
  const resumeFilterHeight = activeSelector === "resume" ? 1 : 0;
  const inputBarHeight = getInputBarHeight({
    input,
    inputWidth: Math.max(1, terminal.columns - 12),
    manualCodePrompt,
    slashCommandCount: slashCandidates.length,
    slashMenuVisible,
    status
  });
  const conversationHeight = Math.max(
    1,
    terminal.rows - HEADER_HEIGHT - resumeFilterHeight - selectorHeight - comboboxHeight - inputBarHeight
  );

  const commit = useCallback((msg: Msg) => {
    setHistory((current) => [...current, msg]);
  }, []);

  const updateInput = useCallback((value: string) => {
    if (activeSelector || activeCombobox) {
      return;
    }

    setInput(value);
    if (renameInputActive) {
      setSlashMenuOpen(false);
      return;
    }

    if (manualCodePrompt) {
      setSlashMenuOpen(false);
      return;
    }

    if (getSlashCommandCompletions(value) !== null) {
      setSlashMenuOpen(true);
      setSlashMenuIndex(0);
    } else {
      setSlashMenuOpen(false);
    }
  }, [activeCombobox, activeSelector, manualCodePrompt, renameInputActive]);

  const completeSlashCommand = useCallback(() => {
    const selected = slashCandidates[selectedSlashIndex];
    if (selected) {
      setInput(selected.command);
      setSlashMenuOpen(false);
      setSlashMenuIndex(0);
    }
  }, [selectedSlashIndex, slashCandidates]);

  const openSelector = useCallback(
    (kind: SelectorKind, flow: SelectorFlow = "standalone", modelsOverride?: AvailableModel[]) => {
      const options =
        kind === "model"
          ? buildModelOptions(currentModel, modelsOverride ?? availableModels)
          : kind === "reasoning"
            ? reasoningOptions
            : kind === "resume"
              ? resumeOptions
              : kind === "resumeProjectFilter"
                ? resumeProjectFilterOptions
                : kind === "resumeLabelFilter"
                  ? resumeLabelFilterOptions
                  : kind === "theme"
                    ? themeOptions
                    : LOGIN_OPTIONS;
      setInput("");
      setSlashMenuOpen(false);
      setSlashMenuIndex(0);
      setActiveSelector(kind);
      setSelectorFlow(flow);
      setSelectorIndex(getCurrentIndex(options));
    },
    [
      availableModels,
      currentModel,
      reasoningOptions,
      resumeLabelFilterOptions,
      resumeOptions,
      resumeProjectFilterOptions,
      themeOptions
    ]
  );

  const closeSelector = useCallback(() => {
    setActiveSelector(null);
    setSelectorFlow("standalone");
    setSelectorIndex(0);
  }, []);

  const closeCombobox = useCallback(() => {
    setActiveCombobox(null);
    setComboboxOptions([]);
    setComboboxIndex(0);
    setComboboxInput("");
  }, []);

  const closeRenameInput = useCallback(() => {
    setRenameInputActive(false);
    setInput("");
    setSlashMenuOpen(false);
    setSlashMenuIndex(0);
  }, []);

  const openRenameInput = useCallback(() => {
    setInput(getRenameInputPrefill(currentSession.metadata));
    setRenameInputActive(true);
    setSlashMenuOpen(false);
    setSlashMenuIndex(0);
  }, [currentSession]);

  const openProjectCombobox = useCallback(async () => {
    setBusy(true);
    setStatus("loading projects...");
    setSlashMenuOpen(false);
    try {
      const options = await listSessionMetadataOptions();
      const projectOptions = buildProjectComboboxOptions(options.projects, currentSession.metadata.project);
      setInput("");
      setActiveCombobox("project");
      setComboboxOptions(projectOptions);
      setComboboxInput("");
      setComboboxIndex(getCurrentIndex(projectOptions));
    } catch (error) {
      commit({ id: nextId(), role: "error", text: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(false);
      setStatus(null);
    }
  }, [commit, currentSession]);

  const openChatLabelCombobox = useCallback(async () => {
    setBusy(true);
    setStatus("loading labels...");
    setSlashMenuOpen(false);
    try {
      const options = await listSessionMetadataOptions();
      const labelOptions = buildChatLabelComboboxOptions(options.labels, currentSession.metadata.labels);
      setInput("");
      setActiveCombobox("chatlabel");
      setComboboxOptions(labelOptions);
      setComboboxInput("");
      setComboboxIndex(getCurrentIndex(labelOptions));
    } catch (error) {
      commit({ id: nextId(), role: "error", text: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(false);
      setStatus(null);
    }
  }, [commit, currentSession]);

  const applyRenameValue = useCallback(
    async (value: string) => {
      const rename = parseRenameInputValue(value);
      if (!rename) {
        commit({ id: nextId(), role: "system", text: "对话名称不能为空" });
        return;
      }

      closeRenameInput();
      setBusy(true);
      setStatus("renaming session...");
      try {
        currentSession.renameConversation(rename.name, rename.project);
        await currentSession.persist();
        const label = formatInputConversationLabel(currentSession.metadata);
        setConversationLabel(label);
        commit({ id: nextId(), role: "system", text: `已重命名: ${label}` });
      } catch (error) {
        commit({ id: nextId(), role: "error", text: error instanceof Error ? error.message : String(error) });
      } finally {
        setBusy(false);
        setStatus(null);
      }
    },
    [closeRenameInput, commit, currentSession]
  );

  const applyProjectValue = useCallback(
    async (project: string | null) => {
      closeCombobox();
      setBusy(true);
      setStatus("setting project...");
      try {
        currentSession.setProject(project);
        await currentSession.persist();
        setConversationLabel(formatInputConversationLabel(currentSession.metadata));
        const projectLabel = currentSession.metadata.project ?? "(无项目)";
        commit({ id: nextId(), role: "system", text: `已设置项目: ${projectLabel}` });
      } catch (error) {
        commit({ id: nextId(), role: "error", text: error instanceof Error ? error.message : String(error) });
      } finally {
        setBusy(false);
        setStatus(null);
      }
    },
    [closeCombobox, commit, currentSession]
  );

  const addChatLabelValue = useCallback(
    async (label: string) => {
      closeCombobox();
      setBusy(true);
      setStatus("adding label...");
      try {
        const added = currentSession.addLabel(label);
        await currentSession.persist();
        setConversationLabel(formatInputConversationLabel(currentSession.metadata));
        const normalizedLabel = normalizeSessionLabels([label])[0] ?? label.trim();
        commit({
          id: nextId(),
          role: "system",
          text: added ? `已添加标签: ${normalizedLabel}` : `标签已存在: ${normalizedLabel}`
        });
      } catch (error) {
        commit({ id: nextId(), role: "error", text: error instanceof Error ? error.message : String(error) });
      } finally {
        setBusy(false);
        setStatus(null);
      }
    },
    [closeCombobox, commit, currentSession]
  );

  const removeChatLabelValue = useCallback(
    async (label: string) => {
      setBusy(true);
      setStatus("removing label...");
      try {
        const removed = currentSession.removeLabel(label);
        await currentSession.persist();
        setConversationLabel(formatInputConversationLabel(currentSession.metadata));
        const normalizedLabel = normalizeSessionLabels([label])[0] ?? label.trim();
        commit({
          id: nextId(),
          role: "system",
          text: removed ? `已移除标签: ${normalizedLabel}` : `标签不存在: ${normalizedLabel}`
        });
      } catch (error) {
        commit({ id: nextId(), role: "error", text: error instanceof Error ? error.message : String(error) });
      } finally {
        setBusy(false);
        setStatus(null);
      }
    },
    [commit, currentSession]
  );

  const submitCombobox = useCallback(
    (value: string) => {
      if (!activeCombobox) {
        return;
      }

      const selected = resolveComboboxSubmission(value, comboboxOptions, selectedComboboxIndex);
      if (activeCombobox === "project") {
        if (selected === CLEAR_PROJECT_OPTION_ID || selected === null) {
          void applyProjectValue(null);
          return;
        }
        void applyProjectValue(selected);
        return;
      }

      if (selected) {
        void addChatLabelValue(selected);
      } else {
        commit({ id: nextId(), role: "system", text: "没有可用标签；请输入新标签。" });
        closeCombobox();
      }
    },
    [
      activeCombobox,
      addChatLabelValue,
      applyProjectValue,
      closeCombobox,
      comboboxOptions,
      commit,
      selectedComboboxIndex
    ]
  );

  const startManualInput = useCallback((prompt: string, mask?: string) => {
    setInput("");
    setSlashMenuOpen(false);
    setManualCodePrompt(prompt);
    setManualInputMask(mask);
    return new Promise<string>((resolve, reject) => {
      manualCodeRef.current = { resolve, reject };
    });
  }, []);

  const startManualCodeInput = useCallback(
    () => startManualInput("粘贴 OAuth code 或回调 URL，回车提交"),
    [startManualInput]
  );

  const runLoginFlow = useCallback(
    async (selectedProvider: ProviderId) => {
      closeSelector();
      setBusy(true);
      setStatus(`logging in ${selectedProvider}...`);

      try {
        if (selectedProvider === "openai-codex") {
          const result = await runSlashCommand(
            { command: "/login", args: [] },
            {
              loginOptions: {
                onAuthUrl: (url) => {
                  commit({
                    id: nextId(),
                    role: "system",
                    text: `请在浏览器完成授权（已尝试自动打开）。如未打开，手动复制此链接：\n${url}`
                  });
                },
                onStatus: setStatus,
                getManualCode: startManualCodeInput
              }
            }
          );
          for (const text of result.messages) {
            commit({ id: nextId(), role: "system", text });
          }
        } else {
          const apiProvider = selectedProvider as ApiKeyProviderId;
          const key = await startManualInput(`粘贴 ${providerLabel(apiProvider)} API key，回车保存`, "*");
          await saveApiKey(apiProvider, key);
          commit({ id: nextId(), role: "system", text: `已登录: ${apiProvider}` });
        }

        const refreshedModels = await loadAvailableModels();
        setAvailableModels(refreshedModels);
      } catch (error) {
        commit({ id: nextId(), role: "error", text: error instanceof Error ? error.message : String(error) });
      } finally {
        manualCodeRef.current = null;
        setManualCodePrompt(null);
        setManualInputMask(undefined);
        setBusy(false);
        setStatus(null);
      }
    },
    [closeSelector, commit, loadAvailableModels, startManualCodeInput, startManualInput]
  );

  const restoreSession = useCallback(
    async (sessionId: string) => {
      closeSelector();
      setBusy(true);
      setStatus("resuming session...");

      try {
        const data = await loadSessionData(sessionId);
        const restored = createSession({
          id: data.id,
          messages: data.messages,
          metadata: data.metadata,
          persisted: true,
          model
        });
        const restoredModel = data.metadata.model ?? model;
        const restoredEffort = data.metadata.reasoningEffort ?? DEFAULT_REASONING_EFFORT;
        setCurrentSession(restored);
        setConversationLabel(formatInputConversationLabel(restored.metadata));
        setCurrentModel(restoredModel);
        setReasoningEffort(restoredEffort);
        setHistory(messagesToHistory(data.messages));
        setTokenState(restored.refreshTokenEstimate(restoredModel, buildSystemPrompt(cwd)));
        commit({
          id: nextId(),
          role: "system",
          text: `已恢复会话: ${formatInputConversationLabel(data.metadata)}`
        });
      } catch (error) {
        commit({ id: nextId(), role: "error", text: error instanceof Error ? error.message : String(error) });
      } finally {
        setBusy(false);
        setStatus(null);
      }
    },
    [closeSelector, commit, cwd, model]
  );

  const openResumeSelector = useCallback(async () => {
    setBusy(true);
    setStatus("loading sessions...");
    try {
      const [sessions, metadataOptions] = await Promise.all([listSessions(), listSessionMetadataOptions()]);
      if (sessions.length === 0) {
        commit({ id: nextId(), role: "system", text: "没有可恢复的会话。" });
        return;
      }

      setResumeSessions(sessions);
      setResumeMetadataOptions(metadataOptions);
      setResumeFilter({ ...DEFAULT_RESUME_FILTER });
      setResumeFocus("sessions");
      setInput("");
      setSlashMenuOpen(false);
      setSlashMenuIndex(0);
      setActiveSelector("resume");
      setSelectorFlow("standalone");
      setSelectorIndex(0);
    } catch (error) {
      commit({ id: nextId(), role: "error", text: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(false);
      setStatus(null);
    }
  }, [commit]);

  useEffect(() => {
    if (openResumeSelectorOnStart) {
      void openResumeSelector();
    }
  }, [openResumeSelector, openResumeSelectorOnStart]);

  const applySelector = useCallback(() => {
    const selected = selectorOptions[selectedSelectorIndex];
    if (!activeSelector || !selected) {
      closeSelector();
      return;
    }

    if (activeSelector === "theme") {
      const nextMode = selected.id as ThemeMode;
      setThemeMode(nextMode);
      const nextThemeName = themeNameForMode(nextMode, terminalAppearance);
      commit({
        id: nextId(),
        role: "system",
        text: `已切换主题: ${THEME_OPTION_LABELS[nextMode]} (${nextThemeName})`
      });
      closeSelector();
      return;
    }

    if (activeSelector === "login") {
      void runLoginFlow(selected.id as ProviderId);
      return;
    }

    if (activeSelector === "resume") {
      if (resumeFocus === "project") {
        setActiveSelector("resumeProjectFilter");
        setSelectorIndex(getCurrentIndex(resumeProjectFilterOptions));
        return;
      }

      if (resumeFocus === "label") {
        setActiveSelector("resumeLabelFilter");
        setSelectorIndex(getCurrentIndex(resumeLabelFilterOptions));
        return;
      }

      if (selected.disabled || selected.id === EMPTY_RESUME_OPTION_ID) {
        return;
      }
      void restoreSession(selected.id);
      return;
    }

    if (activeSelector === "resumeProjectFilter") {
      setResumeFilter((current) => ({
        ...current,
        project: selected.id === CLEAR_RESUME_FILTER_OPTION_ID ? null : selected.id
      }));
      setActiveSelector("resume");
      setResumeFocus("sessions");
      setSelectorIndex(0);
      return;
    }

    if (activeSelector === "resumeLabelFilter") {
      setResumeFilter((current) => ({
        ...current,
        label: selected.id === CLEAR_RESUME_FILTER_OPTION_ID ? null : selected.id
      }));
      setActiveSelector("resume");
      setResumeFocus("sessions");
      setSelectorIndex(0);
      return;
    }

    const transition = applySelectorTransition({
      activeSelector,
      selectorFlow,
      selectedId: selected.id,
      selectedProvider: selected.provider as ProviderId | undefined,
      currentModel,
      reasoningEffort
    });

    setCurrentModel(transition.currentModel);
    setReasoningEffort(transition.reasoningEffort);
    currentSession.setRunState(transition.currentModel, transition.reasoningEffort);
    setTokenState(currentSession.getTokenState(transition.currentModel));
    if (transition.message) {
      commit({ id: nextId(), role: "system", text: transition.message });
    }

    if (transition.nextSelector) {
      const options = transition.nextSelector === "model" ? modelOptions : reasoningOptions;
      setActiveSelector(transition.nextSelector);
      setSelectorFlow(transition.nextSelectorFlow);
      setSelectorIndex(getCurrentIndex(options));
    } else {
      closeSelector();
    }
  }, [
    activeSelector,
    closeSelector,
    commit,
    currentSession,
    currentModel,
    modelOptions,
    reasoningEffort,
    reasoningOptions,
    resumeFocus,
    resumeLabelFilterOptions,
    resumeProjectFilterOptions,
    runLoginFlow,
    restoreSession,
    selectedSelectorIndex,
    selectorFlow,
    selectorOptions,
    terminalAppearance
  ]);

  useInput((value, key) => {
    if (key.ctrl && value === "c") {
      if (busy) {
        manualCodeRef.current?.reject(new Error("input cancelled"));
        manualCodeRef.current = null;
        setManualCodePrompt(null);
        setManualInputMask(undefined);
        setInput("");
        abortRef.current?.abort();
        setStatus("aborting...");
      } else {
        exit();
      }
    }

    if (renameInputActive) {
      if (key.escape) {
        commit({ id: nextId(), role: "system", text: "已取消重命名" });
        closeRenameInput();
      }
      return;
    }

    if (activeCombobox) {
      if (key.escape) {
        commit({
          id: nextId(),
          role: "system",
          text: activeCombobox === "project" ? "已取消项目选择" : "已取消标签选择"
        });
        closeCombobox();
        return;
      }

      if (!isOptionComboboxTyping(comboboxInput) && key.upArrow) {
        setComboboxIndex((current) => moveSelection(current, -1, comboboxOptions.length));
        return;
      }

      if (!isOptionComboboxTyping(comboboxInput) && key.downArrow) {
        setComboboxIndex((current) => moveSelection(current, 1, comboboxOptions.length));
        return;
      }

      return;
    }

    if (activeSelector) {
      if (activeSelector === "resumeProjectFilter" || activeSelector === "resumeLabelFilter") {
        if (key.escape) {
          setActiveSelector("resume");
          setResumeFocus(activeSelector === "resumeProjectFilter" ? "project" : "label");
          setSelectorIndex(0);
          return;
        }

        if (key.upArrow) {
          setSelectorIndex((current) => moveSelection(current, -1, selectorOptions.length));
          return;
        }

        if (key.downArrow) {
          setSelectorIndex((current) => moveSelection(current, 1, selectorOptions.length));
          return;
        }

        if (key.return) {
          applySelector();
        }

        return;
      }

      if (activeSelector === "resume") {
        if (key.escape) {
          const transition = cancelSelectorTransition({
            activeSelector,
            selectorFlow,
            currentModel,
            reasoningEffort
          });
          if (transition.message) {
            commit({ id: nextId(), role: "system", text: transition.message });
          }
          closeSelector();
          return;
        }

        if (key.tab) {
          setResumeFocus((current) => (current === "project" ? "label" : current === "label" ? "sessions" : "project"));
          return;
        }

        if (key.leftArrow) {
          setResumeFocus((current) => (current === "label" ? "project" : "label"));
          return;
        }

        if (key.rightArrow) {
          setResumeFocus((current) => (current === "project" ? "label" : "sessions"));
          return;
        }

        if (key.upArrow) {
          if (resumeFocus === "sessions" && selectorIndex === 0) {
            setResumeFocus("label");
          } else if (resumeFocus === "sessions") {
            setSelectorIndex((current) => moveSelection(current, -1, selectorOptions.length));
          } else {
            setResumeFocus(resumeFocus === "label" ? "project" : "sessions");
          }
          return;
        }

        if (key.downArrow) {
          if (resumeFocus === "sessions") {
            setSelectorIndex((current) => moveSelection(current, 1, selectorOptions.length));
          } else {
            setResumeFocus("sessions");
          }
          return;
        }

        if (key.return) {
          applySelector();
        }

        return;
      }

      if (key.escape) {
        const transition = cancelSelectorTransition({
          activeSelector,
          selectorFlow,
          currentModel,
          reasoningEffort
        });
        if (transition.message) {
          commit({ id: nextId(), role: "system", text: transition.message });
        }
        closeSelector();
        return;
      }

      if (key.upArrow) {
        setSelectorIndex((current) => moveSelection(current, -1, selectorOptions.length));
        return;
      }

      if (key.downArrow) {
        setSelectorIndex((current) => moveSelection(current, 1, selectorOptions.length));
        return;
      }

      if (key.return) {
        applySelector();
      }

      return;
    }

    if (!slashMenuVisible) {
      return;
    }

    if (key.escape) {
      setSlashMenuOpen(false);
      return;
    }

    if (key.upArrow && slashCandidates.length > 0) {
      setSlashMenuIndex((current) => (current - 1 + slashCandidates.length) % slashCandidates.length);
      return;
    }

    if (key.downArrow && slashCandidates.length > 0) {
      setSlashMenuIndex((current) => (current + 1) % slashCandidates.length);
      return;
    }

    if (key.tab) {
      completeSlashCommand();
    }
  });

  const submit = useCallback(
    async (value: string) => {
      if (renameInputActive) {
        await applyRenameValue(value);
        return;
      }

      if (manualCodePrompt) {
        if (!value.trim()) {
          return;
        }

        const pending = manualCodeRef.current;
        manualCodeRef.current = null;
        setManualCodePrompt(null);
        setManualInputMask(undefined);
        setInput("");
        pending?.resolve(value);
        return;
      }

      const prompt = value.trim();
      if (!prompt || busy) {
        return;
      }

      updateInput("");

      const slash = parseSlash(value);
      if (slash) {
        if (slash.command === "/login") {
          openSelector("login");
          return;
        }

        if (slash.command === "/model") {
          setSlashMenuOpen(false);
          setBusy(true);
          setStatus("loading models...");
          try {
            const refreshedModels = await loadAvailableModels();
            setAvailableModels(refreshedModels);
            if (refreshedModels.length === 0) {
              commit({ id: nextId(), role: "system", text: "未登录任何 provider，请先 /login。" });
            } else {
              openSelector("model", "modelEffortChain", refreshedModels);
            }
          } catch (error) {
            commit({ id: nextId(), role: "error", text: error instanceof Error ? error.message : String(error) });
          } finally {
            setBusy(false);
            setStatus(null);
          }
          return;
        }

        if (slash.command === "/reasoning") {
          if (!providerSupportsReasoningEffort(currentProvider)) {
            commit({
              id: nextId(),
              role: "system",
              text: `${providerLabel(currentProvider)} 不支持 reasoning effort。`
            });
            return;
          }
          openSelector("reasoning");
          return;
        }

        if (slash.command === "/theme") {
          setSlashMenuOpen(false);
          openSelector("theme");
          return;
        }

        if (slash.command === "/resume") {
          setSlashMenuOpen(false);
          await openResumeSelector();
          return;
        }

        if (slash.command === "/rename") {
          setSlashMenuOpen(false);
          const action = resolveRenameSlashAction(slash.args, getRenameInputPrefill(currentSession.metadata));
          if (action.kind === "input") {
            openRenameInput();
            return;
          }
          if (action.kind === "invalid") {
            commit({ id: nextId(), role: "system", text: "用法: /rename <名称> 或 /rename <项目>/<名称>" });
            return;
          }

          setBusy(true);
          setStatus("renaming session...");
          try {
            currentSession.renameConversation(action.rename.name, action.rename.project);
            await currentSession.persist();
            const label = formatInputConversationLabel(currentSession.metadata);
            setConversationLabel(label);
            commit({ id: nextId(), role: "system", text: `已重命名: ${label}` });
          } catch (error) {
            commit({ id: nextId(), role: "error", text: error instanceof Error ? error.message : String(error) });
          } finally {
            setBusy(false);
            setStatus(null);
          }
          return;
        }

        if (slash.command === "/project") {
          setSlashMenuOpen(false);
          const project = parseProjectCommandArgs(slash.args);
          if (!project) {
            await openProjectCombobox();
            return;
          }

          await applyProjectValue(project.project);
          return;
        }

        if (slash.command === "/chatlabel") {
          setSlashMenuOpen(false);
          const chatLabel = parseChatLabelCommandArgs(slash.args);
          if (!chatLabel) {
            await openChatLabelCombobox();
            return;
          }

          if (chatLabel.action === "remove") {
            await removeChatLabelValue(chatLabel.label);
          } else {
            await addChatLabelValue(chatLabel.label);
          }
          return;
        }

        if (slash.command === "/compact") {
          setSlashMenuOpen(false);
          setBusy(true);
          setStatus("compacting...");
          try {
            const turnModels = availableModels.length > 0 ? availableModels : await loadAvailableModels().catch(() => []);
            if (turnModels.length > 0) {
              setAvailableModels(turnModels);
            }
            const compactProvider = provider ?? (await resolveProvider(currentModel, turnModels));
            const compactProviderId = getProviderForModel(currentModel, turnModels);
            const result = await currentSession.maybeCompact({
              provider: compactProvider,
              model: currentModel,
              reasoningEffort: providerSupportsReasoningEffort(compactProviderId) ? reasoningEffort : undefined,
              systemPrompt: buildSystemPrompt(cwd),
              force: true
            });
            await currentSession.persist();
            setTokenState(currentSession.getTokenState(currentModel));
            commit({
              id: nextId(),
              role: "system",
              text: result.compacted
                ? `已压缩上下文（节省 ~${result.savedTokens} token）`
                : `未压缩上下文：${result.reason ?? "没有可压缩内容"}`
            });
          } catch (error) {
            commit({ id: nextId(), role: "error", text: error instanceof Error ? error.message : String(error) });
          } finally {
            setBusy(false);
            setStatus(null);
          }
          return;
        }

        setSlashMenuOpen(false);
        setBusy(true);
        setStatus(`running ${slash.command}...`);
        try {
          const result = await runSlashCommand(slash);
          for (const text of result.messages) {
            commit({ id: nextId(), role: "system", text });
          }
          if (slash.command === "/logout") {
            setAvailableModels([]);
          }
          if (result.action === "exit") {
            exit();
          }
        } catch (error) {
          commit({ id: nextId(), role: "error", text: error instanceof Error ? error.message : String(error) });
        } finally {
          manualCodeRef.current = null;
          setManualCodePrompt(null);
          setManualInputMask(undefined);
          setBusy(false);
          setStatus(null);
        }
        return;
      }

      setBusy(true);
      setStatus("thinking...");
      commit({ id: nextId(), role: "user", text: prompt });

      const abort = new AbortController();
      abortRef.current = abort;
      let streamBuffer = "";

      const commitAssistant = () => {
        if (streamBuffer.length > 0) {
          commit({ id: nextId(), role: "assistant", text: streamBuffer });
          streamBuffer = "";
          setStreaming(null);
        }
      };

      try {
        const turnModels = availableModels.length > 0 ? availableModels : await loadAvailableModels().catch(() => []);
        if (turnModels.length > 0) {
          setAvailableModels(turnModels);
        }
        const turnProvider = provider ?? (await resolveProvider(currentModel, turnModels));
        const turnProviderId = getProviderForModel(currentModel, turnModels);
        for await (const event of runTurn(currentSession, prompt, {
          provider: turnProvider,
          tools,
          model: currentModel,
          reasoningEffort: providerSupportsReasoningEffort(turnProviderId) ? reasoningEffort : undefined,
          cwd,
          signal: abort.signal
        })) {
          setConversationLabel(formatInputConversationLabel(currentSession.metadata));
          if (event.type === "assistant_text") {
            streamBuffer += event.delta;
            setStreaming(streamBuffer);
          } else if (event.type === "tool_start") {
            commitAssistant();
            setStatus(`running ${event.activity}`);
          } else if (event.type === "tool_end") {
            commit({
              id: nextId(),
              role: "tool",
              text: event.result.output,
              tool: {
                name: event.call.name,
                args: event.call.arguments,
                resultSummary: summarize(event.result.output),
                isError: event.result.isError
              }
            });
            setStatus("thinking...");
          } else if (event.type === "token_update") {
            setTokenState(event.state);
          } else if (event.type === "compaction") {
            commit({
              id: nextId(),
              role: "system",
              text: `已压缩上下文（节省 ~${event.result.savedTokens} token）`
            });
          } else if (event.type === "turn_done") {
            commitAssistant();
            setStatus(null);
            setBusy(false);
          } else if (event.type === "error") {
            commitAssistant();
            commit({ id: nextId(), role: "error", text: event.message });
            setStatus(null);
            setBusy(false);
          }
        }
      } finally {
        abortRef.current = null;
        setBusy(false);
        setStatus(null);
      }
    },
    [
      addChatLabelValue,
      applyRenameValue,
      applyProjectValue,
      busy,
      commit,
      currentSession,
      currentModel,
      currentProvider,
      cwd,
      exit,
      availableModels,
      loadAvailableModels,
      manualCodePrompt,
      openChatLabelCombobox,
      openProjectCombobox,
      openRenameInput,
      openSelector,
      openResumeSelector,
      provider,
      reasoningEffort,
      renameInputActive,
      removeChatLabelValue,
      resolveProvider,
      runTurn,
      tools,
      updateInput
    ]
  );

  useInput(
    (_value, key) => {
      if (!slashMenuVisible || !key.return) {
        return;
      }

      void submit(resolveSlashEnterSubmission(input, slashCandidates, selectedSlashIndex));
    },
    { isActive: slashMenuVisible }
  );

  return (
    <Box flexDirection="column" height={terminal.rows} width={terminal.columns}>
      <Header
        labels={currentSession.metadata.labels}
        model={currentModel}
        name={currentSession.metadata.name}
        project={currentSession.metadata.project}
        provider={currentProvider}
        reasoningEffort={providerSupportsReasoningEffort(currentProvider) ? reasoningEffort : null}
        theme={theme}
        width={terminal.columns}
      />
      <Conversation
        height={conversationHeight}
        messages={history}
        streaming={streaming}
        theme={theme}
        width={terminal.columns}
      />
      {activeSelector === "resume" ? (
        <ResumeFilterBar filter={resumeFilter} focus={resumeFocus} theme={theme} width={terminal.columns} />
      ) : null}
      {selectorVisible ? (
        <OptionSelector
          options={selectorOptions}
          selectedIndex={activeSelector === "resume" && resumeFocus !== "sessions" ? -1 : selectedSelectorIndex}
          title={
            activeSelector === "model"
              ? "Select model"
              : activeSelector === "login"
                ? "Select provider"
                : activeSelector === "resume"
                  ? "Resume session"
                  : activeSelector === "resumeProjectFilter"
                    ? "Filter project"
                    : activeSelector === "resumeLabelFilter"
                      ? "Filter label"
                      : activeSelector === "theme"
                        ? "Select theme"
                        : "Select reasoning effort"
          }
          theme={theme}
          width={terminal.columns}
        />
      ) : null}
      {comboboxVisible ? (
        <OptionCombobox
          input={comboboxInput}
          onChange={setComboboxInput}
          onSubmit={submitCombobox}
          options={comboboxOptions}
          selectedIndex={selectedComboboxIndex}
          theme={theme}
          title={activeCombobox === "project" ? "Set project" : "Add label"}
          width={terminal.columns}
        />
      ) : null}
      <InputBar
        disabled={selectorVisible || comboboxVisible || (busy && !manualCodePrompt)}
        disabledLabel={selectorVisible || comboboxVisible ? "" : undefined}
        input={input}
        inputMask={manualInputMask}
        inputPrompt={renameInputActive ? RENAME_INPUT_PROMPT : undefined}
        manualCodePrompt={manualCodePrompt}
        onChange={updateInput}
        onSubmit={slashMenuVisible || selectorVisible ? undefined : submit}
        selectedSlashIndex={selectedSlashIndex}
        slashCandidates={slashCandidates}
        slashCommandCount={slashCandidates.length}
        slashMenuVisible={slashMenuVisible}
        status={status}
        theme={theme}
        tokenState={tokenState}
        conversationLabel={conversationLabel}
        width={terminal.columns}
      />
    </Box>
  );
}
