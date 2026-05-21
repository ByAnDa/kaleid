import React, { useCallback, useMemo, useRef, useState } from "react";
import { Box, Static, Text, useApp, useInput } from "ink";
import TextInput from "ink-text-input";
import type { runTurn as runTurnFn } from "../loop/agent-loop.js";
import type { Session } from "../loop/session.js";
import type { LLMProvider } from "../provider/types.js";
import type { Tool } from "../tools/types.js";
import type { ToolCallView } from "./components/ToolCall.js";
import { getSlashCommandCompletions, parseSlash, runSlashCommand } from "./commands.js";
import { Message } from "./components/Message.js";
import { SlashMenu } from "./components/SlashMenu.js";
import { StatusLine } from "./components/StatusLine.js";

export interface Msg {
  id: string;
  role: "user" | "assistant" | "tool" | "error" | "system";
  text: string;
  tool?: ToolCallView;
}

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

export function App({ model, cwd, session, provider, tools, runTurn }: AppProps): React.ReactElement {
  const { exit } = useApp();
  const [history, setHistory] = useState<Msg[]>([]);
  const [streaming, setStreaming] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [slashMenuIndex, setSlashMenuIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const slashCandidates = useMemo(() => getSlashCommandCompletions(input) ?? [], [input]);
  const slashMenuVisible = !busy && slashMenuOpen && getSlashCommandCompletions(input) !== null;
  const selectedSlashIndex = slashCandidates.length === 0 ? -1 : Math.min(slashMenuIndex, slashCandidates.length - 1);

  const commit = useCallback((msg: Msg) => {
    setHistory((current) => [...current, msg]);
  }, []);

  const updateInput = useCallback((value: string) => {
    setInput(value);
    if (getSlashCommandCompletions(value) !== null) {
      setSlashMenuOpen(true);
      setSlashMenuIndex(0);
    } else {
      setSlashMenuOpen(false);
    }
  }, []);

  const completeSlashCommand = useCallback(() => {
    const selected = slashCandidates[selectedSlashIndex];
    if (selected) {
      setInput(selected.command);
      setSlashMenuOpen(false);
      setSlashMenuIndex(0);
    }
  }, [selectedSlashIndex, slashCandidates]);

  useInput((value, key) => {
    if (key.ctrl && value === "c") {
      if (busy) {
        abortRef.current?.abort();
        setStatus("aborting...");
      } else {
        exit();
      }
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
      const prompt = value.trim();
      if (!prompt || busy) {
        return;
      }

      updateInput("");

      const slash = parseSlash(value);
      if (slash) {
        setSlashMenuOpen(false);
        setBusy(true);
        setStatus(`running ${slash.command}...`);
        try {
          const result = await runSlashCommand(slash);
          for (const text of result.messages) {
            commit({ id: nextId(), role: "system", text });
          }
          if (result.action === "exit") {
            exit();
          }
        } catch (error) {
          commit({ id: nextId(), role: "error", text: error instanceof Error ? error.message : String(error) });
        } finally {
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
          model,
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
    [busy, commit, cwd, exit, model, provider, runTurn, session, tools, updateInput]
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
    <Box flexDirection="column">
      <Static items={history}>{(msg) => <Message key={msg.id} msg={msg} />}</Static>
      {streaming ? <Text color="cyan">{streaming}</Text> : null}
      {status ? <StatusLine status={status} /> : null}
      {!busy ? (
        <>
          <Box>
            <Text color="green">&gt; </Text>
            <TextInput
              value={input}
              onChange={updateInput}
              onSubmit={slashMenuVisible ? undefined : submit}
            />
          </Box>
          {slashMenuVisible ? <SlashMenu commands={slashCandidates} selectedIndex={selectedSlashIndex} /> : null}
        </>
      ) : null}
    </Box>
  );
}
