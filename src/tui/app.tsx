import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, useApp, useInput } from "ink";
import type { runTurn as runTurnFn } from "../loop/agent-loop.js";
import type { Session } from "../loop/session.js";
import {
  DEFAULT_REASONING_EFFORT,
  REASONING_LEVELS,
  getModelOptions,
  isReasoningEffort,
  type ReasoningEffort
} from "../provider/models.js";
import type { LLMProvider } from "../provider/types.js";
import type { Tool } from "../tools/types.js";
import { getSlashCommandCompletions, parseSlash, runSlashCommand } from "./commands.js";
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
  provider: LLMProvider;
  tools: Tool[];
  runTurn: typeof runTurnFn;
}

function summarize(text: string): string {
  return (text.split(/\r?\n/u)[0] ?? "").slice(0, 160);
}

function nextId(): string {
  return crypto.randomUUID();
}

export type SelectorKind = "model" | "reasoning";
export type SelectorFlow = "standalone" | "modelEffortChain";

export interface SelectorTransitionInput {
  activeSelector: SelectorKind;
  selectorFlow: SelectorFlow;
  selectedId: string;
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

export function applySelectorTransition(input: SelectorTransitionInput): SelectorTransition {
  if (input.activeSelector === "model") {
    const shouldSelectEffort = input.selectorFlow === "modelEffortChain";
    return {
      currentModel: input.selectedId,
      reasoningEffort: input.reasoningEffort,
      nextSelector: shouldSelectEffort ? "reasoning" : null,
      nextSelectorFlow: shouldSelectEffort ? "modelEffortChain" : "standalone",
      message: shouldSelectEffort ? null : `已切换模型: ${input.selectedId}`
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
    message: input.activeSelector === "model" ? "已取消模型选择" : "已取消推理强度选择"
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

export function App({ model, cwd, session, provider, tools, runTurn }: AppProps): React.ReactElement {
  const { exit } = useApp();
  const terminal = useTerminalDimensions();
  const [currentModel, setCurrentModel] = useState(model);
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort>(DEFAULT_REASONING_EFFORT);
  const [history, setHistory] = useState<Msg[]>([]);
  const [streaming, setStreaming] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [slashMenuIndex, setSlashMenuIndex] = useState(0);
  const [activeSelector, setActiveSelector] = useState<SelectorKind | null>(null);
  const [selectorFlow, setSelectorFlow] = useState<SelectorFlow>("standalone");
  const [selectorIndex, setSelectorIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [manualCodePrompt, setManualCodePrompt] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const manualCodeRef = useRef<{ resolve: (value: string) => void; reject: (error: Error) => void } | null>(null);
  const slashCompletions = useMemo(() => getSlashCommandCompletions(input), [input]);
  const slashCandidates = slashCompletions ?? [];
  const slashMenuVisible = !busy && !manualCodePrompt && !activeSelector && slashMenuOpen && slashCompletions !== null;
  const selectedSlashIndex = slashCandidates.length === 0 ? -1 : Math.min(slashMenuIndex, slashCandidates.length - 1);
  const modelOptions = useMemo<OptionSelectorItem[]>(
    () =>
      getModelOptions(currentModel).map((option) => ({
        id: option.id,
        label: option.label,
        current: option.id === currentModel
      })),
    [currentModel]
  );
  const reasoningOptions = useMemo<OptionSelectorItem[]>(
    () =>
      REASONING_LEVELS.map((level) => ({
        id: level,
        current: level === reasoningEffort
      })),
    [reasoningEffort]
  );
  const selectorOptions = activeSelector === "model" ? modelOptions : activeSelector === "reasoning" ? reasoningOptions : [];
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
    (kind: SelectorKind, flow: SelectorFlow = "standalone") => {
      const options = kind === "model" ? modelOptions : reasoningOptions;
      setInput("");
      setSlashMenuOpen(false);
      setSlashMenuIndex(0);
      setActiveSelector(kind);
      setSelectorFlow(flow);
      setSelectorIndex(getCurrentIndex(options));
    },
    [modelOptions, reasoningOptions]
  );

  const closeSelector = useCallback(() => {
    setActiveSelector(null);
    setSelectorFlow("standalone");
    setSelectorIndex(0);
  }, []);

  const applySelector = useCallback(() => {
    const selected = selectorOptions[selectedSelectorIndex];
    if (!activeSelector || !selected) {
      closeSelector();
      return;
    }

    const transition = applySelectorTransition({
      activeSelector,
      selectorFlow,
      selectedId: selected.id,
      currentModel,
      reasoningEffort
    });

    setCurrentModel(transition.currentModel);
    setReasoningEffort(transition.reasoningEffort);
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
    currentModel,
    modelOptions,
    reasoningEffort,
    reasoningOptions,
    selectedSelectorIndex,
    selectorFlow,
    selectorOptions
  ]);

  useInput((value, key) => {
    if (key.ctrl && value === "c") {
      if (busy) {
        manualCodeRef.current?.reject(new Error("OAuth login cancelled"));
        manualCodeRef.current = null;
        setManualCodePrompt(null);
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

  const startManualCodeInput = useCallback(() => {
    setInput("");
    setSlashMenuOpen(false);
    setManualCodePrompt("粘贴 OAuth code 或回调 URL，回车提交");
    return new Promise<string>((resolve, reject) => {
      manualCodeRef.current = { resolve, reject };
    });
  }, []);

  const submit = useCallback(
    async (value: string) => {
      if (manualCodePrompt) {
        if (!value.trim()) {
          return;
        }

        const pending = manualCodeRef.current;
        manualCodeRef.current = null;
        setManualCodePrompt(null);
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
        if (slash.command === "/model") {
          openSelector("model", "modelEffortChain");
          return;
        }

        if (slash.command === "/reasoning") {
          openSelector("reasoning");
          return;
        }

        const isLoginCommand = slash.command === "/login";
        setSlashMenuOpen(false);
        setBusy(true);
        setStatus(`running ${slash.command}...`);
        try {
          const result = await runSlashCommand(slash, {
            loginOptions: isLoginCommand
              ? {
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
              : undefined
          });
          for (const text of result.messages) {
            commit({ id: nextId(), role: "system", text });
          }
          if (result.action === "exit") {
            exit();
          }
        } catch (error) {
          commit({ id: nextId(), role: "error", text: error instanceof Error ? error.message : String(error) });
        } finally {
          manualCodeRef.current = null;
          setManualCodePrompt(null);
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
        for await (const event of runTurn(session, prompt, {
          provider,
          tools,
          model: currentModel,
          reasoningEffort,
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
      currentModel,
      cwd,
      exit,
      manualCodePrompt,
      openSelector,
      provider,
      reasoningEffort,
      runTurn,
      session,
      startManualCodeInput,
      tools,
      updateInput
    ]
  );

  useInput(
    (_value, key) => {
      if (!slashMenuVisible || !key.return) {
        return;
      }

      const selected = slashCandidates[selectedSlashIndex];
      if (selected && input !== selected.command) {
        completeSlashCommand();
        return;
      }

      void submit(input);
    },
    { isActive: slashMenuVisible }
  );

  return (
    <Box flexDirection="column" height={terminal.rows} width={terminal.columns}>
      <Header model={currentModel} reasoningEffort={reasoningEffort} width={terminal.columns} />
      <Conversation height={conversationHeight} messages={history} streaming={streaming} width={terminal.columns} />
      {selectorVisible ? (
        <OptionSelector
          options={selectorOptions}
          selectedIndex={selectedSelectorIndex}
          title={activeSelector === "model" ? "Select model" : "Select reasoning effort"}
          width={terminal.columns}
        />
      ) : null}
      <InputBar
        disabled={selectorVisible || (busy && !manualCodePrompt)}
        disabledLabel={selectorVisible ? "" : undefined}
        input={input}
        manualCodePrompt={manualCodePrompt}
        onChange={updateInput}
        onSubmit={slashMenuVisible || selectorVisible ? undefined : submit}
        selectedSlashIndex={selectedSlashIndex}
        slashCandidates={slashCandidates}
        slashCommandCount={slashCandidates.length}
        slashMenuVisible={slashMenuVisible}
        status={status}
        width={terminal.columns}
      />
    </Box>
  );
}
