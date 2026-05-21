import React, { useCallback, useRef, useState } from "react";
import { Box, Static, Text, useApp, useInput } from "ink";
import TextInput from "ink-text-input";
import type { runTurn as runTurnFn } from "../loop/agent-loop.js";
import type { Session } from "../loop/session.js";
import type { LLMProvider } from "../provider/types.js";
import type { Tool } from "../tools/types.js";
import type { ToolCallView } from "./components/ToolCall.js";
import { Message } from "./components/Message.js";
import { StatusLine } from "./components/StatusLine.js";

export interface Msg {
  id: string;
  role: "user" | "assistant" | "tool" | "error";
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
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const commit = useCallback((msg: Msg) => {
    setHistory((current) => [...current, msg]);
  }, []);

  useInput((value, key) => {
    if (key.ctrl && value === "c") {
      if (busy) {
        abortRef.current?.abort();
        setStatus("aborting...");
      } else {
        exit();
      }
    }
  });

  const submit = useCallback(
    async (value: string) => {
      const prompt = value.trim();
      if (!prompt || busy) {
        return;
      }

      if (prompt === "exit" || prompt === "quit") {
        exit();
        return;
      }

      setInput("");
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
    [busy, commit, cwd, exit, model, provider, runTurn, session, tools]
  );

  return (
    <Box flexDirection="column">
      <Static items={history}>{(msg) => <Message key={msg.id} msg={msg} />}</Static>
      {streaming ? <Text color="cyan">{streaming}</Text> : null}
      {status ? <StatusLine status={status} /> : null}
      {!busy ? (
        <Box>
          <Text color="green">&gt; </Text>
          <TextInput value={input} onChange={setInput} onSubmit={submit} />
        </Box>
      ) : null}
    </Box>
  );
}
