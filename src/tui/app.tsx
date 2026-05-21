import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, useApp, useInput } from "ink";
import { saveApiKey, type ApiKeyProviderId } from "../auth/config-store.js";
import type { runTurn as runTurnFn } from "../loop/agent-loop.js";
import { buildSystemPrompt } from "../loop/system-prompt.js";
import { createSession, type Session, type TokenState } from "../loop/session.js";
import { listSessions, loadSessionData, type SessionSummary } from "../loop/session-store.js";
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
  parseSlash,
  runSlashCommand,
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
import { getTerminalDimensions, type TerminalDimensions } from "./terminal.js";
import type { Msg } from "./types.js";

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

function resumeToOption(session: SessionSummary): OptionSelectorItem {
  const model = session.model ? ` · ${session.model}` : "";
  return {
    id: session.id,
    label: `${session.title}${model}`,
    current: false
  };
}

export type SelectorKind = "model" | "reasoning" | "login" | "resume";
export type SelectorFlow = "standalone" | "modelEffortChain";

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
  const [resumeOptions, setResumeOptions] = useState<OptionSelectorItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [manualCodePrompt, setManualCodePrompt] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const manualCodeRef = useRef<{ resolve: (value: string) => void; reject: (error: Error) => void } | null>(null);
  const slashCompletions = useMemo(() => getSlashCommandCompletions(input), [input]);
  const slashCandidates = slashCompletions ?? [];
  const slashMenuVisible = !busy && !manualCodePrompt && !activeSelector && slashMenuOpen && slashCompletions !== null;
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
  const selectorOptions =
    activeSelector === "model"
      ? modelOptions
      : activeSelector === "reasoning"
        ? reasoningOptions
        : activeSelector === "login"
          ? LOGIN_OPTIONS
          : activeSelector === "resume"
            ? resumeOptions
            : [];
  const selectedSelectorIndex =
    selectorOptions.length === 0 ? -1 : Math.min(selectorIndex, selectorOptions.length - 1);
  const selectorVisible = activeSelector !== null;
  const selectorHeight = selectorVisible ? getOptionSelectorHeight(selectorOptions.length) : 0;
  const inputBarHeight = getInputBarHeight({
    manualCodePrompt,
    slashCommandCount: slashCandidates.length,
    slashMenuVisible,
    status
  });
  const conversationHeight = Math.max(1, terminal.rows - HEADER_HEIGHT - selectorHeight - inputBarHeight);

  const commit = useCallback((msg: Msg) => {
    setHistory((current) => [...current, msg]);
  }, []);

  const updateInput = useCallback((value: string) => {
    if (activeSelector) {
      return;
    }

    setInput(value);
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
  }, [activeSelector, manualCodePrompt]);

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
              : LOGIN_OPTIONS;
      setInput("");
      setSlashMenuOpen(false);
      setSlashMenuIndex(0);
      setActiveSelector(kind);
      setSelectorFlow(flow);
      setSelectorIndex(getCurrentIndex(options));
    },
    [availableModels, currentModel, reasoningOptions, resumeOptions]
  );

  const closeSelector = useCallback(() => {
    setActiveSelector(null);
    setSelectorFlow("standalone");
    setSelectorIndex(0);
  }, []);

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
        setCurrentModel(restoredModel);
        setReasoningEffort(restoredEffort);
        setHistory(messagesToHistory(data.messages));
        setTokenState(restored.refreshTokenEstimate(restoredModel, buildSystemPrompt(cwd)));
        commit({ id: nextId(), role: "system", text: `已恢复会话: ${data.metadata.title ?? data.id}` });
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
      const sessions = await listSessions();
      if (sessions.length === 0) {
        commit({ id: nextId(), role: "system", text: "没有可恢复的会话。" });
        return;
      }

      const options = sessions.map(resumeToOption);
      setResumeOptions(options);
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

    if (activeSelector === "login") {
      void runLoginFlow(selected.id as ProviderId);
      return;
    }

    if (activeSelector === "resume") {
      void restoreSession(selected.id);
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
    runLoginFlow,
    restoreSession,
    selectedSelectorIndex,
    selectorFlow,
    selectorOptions
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

    if (activeSelector) {
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

        if (slash.command === "/resume") {
          setSlashMenuOpen(false);
          await openResumeSelector();
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
      openSelector,
      openResumeSelector,
      provider,
      reasoningEffort,
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
        model={currentModel}
        provider={currentProvider}
        reasoningEffort={providerSupportsReasoningEffort(currentProvider) ? reasoningEffort : null}
        width={terminal.columns}
      />
      <Conversation height={conversationHeight} messages={history} streaming={streaming} width={terminal.columns} />
      {selectorVisible ? (
        <OptionSelector
          options={selectorOptions}
          selectedIndex={selectedSelectorIndex}
          title={
            activeSelector === "model"
              ? "Select model"
              : activeSelector === "login"
                ? "Select provider"
                : activeSelector === "resume"
                  ? "Resume session"
                  : "Select reasoning effort"
          }
          width={terminal.columns}
        />
      ) : null}
      <InputBar
        disabled={selectorVisible || (busy && !manualCodePrompt)}
        disabledLabel={selectorVisible ? "" : undefined}
        input={input}
        inputMask={manualInputMask}
        manualCodePrompt={manualCodePrompt}
        onChange={updateInput}
        onSubmit={slashMenuVisible || selectorVisible ? undefined : submit}
        selectedSlashIndex={selectedSlashIndex}
        slashCandidates={slashCandidates}
        slashCommandCount={slashCandidates.length}
        slashMenuVisible={slashMenuVisible}
        status={status}
        tokenState={tokenState}
        width={terminal.columns}
      />
    </Box>
  );
}
