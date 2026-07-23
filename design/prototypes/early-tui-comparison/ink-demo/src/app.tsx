// kaleid TUI demo — 方案 1: ink (React for CLI)
//
// 防闪原则（对应 Claude Code 早期闪烁问题的解法）：
//   1. 已完成的历史消息全部塞进 <Static>，ink 对 Static 项「渲染一次、永不重绘」，
//      所以历史再长也不会随每帧重画 —— 这是闪烁的根因消除。
//   2. 只有「正在流式生成的那一条」+ spinner + 输入框 在动态区，
//      ink 的 reconciler 只 patch 变化的行（不整屏清除）。
//   3. 动态区保持很小：消息一完成就 commit 进 Static。
//
// 跑法: npm i && npm start   （在真实终端里跑）

import { useEffect, useState } from "react";
import { Box, Static, Text, render } from "ink";
import TextInput from "ink-text-input";
import Spinner from "ink-spinner";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Role = "user" | "assistant" | "tool";
interface Msg {
  id: number;
  role: Role;
  text: string;
  tool?: { name: string; args: string; result: string };
}

let _id = 0;
const nextId = () => ++_id;

function MessageView({ msg }: { msg: Msg }) {
  if (msg.role === "user") {
    return (
      <Text>
        <Text color="green" bold>you › </Text>
        {msg.text}
      </Text>
    );
  }
  if (msg.role === "tool" && msg.tool) {
    return (
      <Box flexDirection="column">
        <Text>
          <Text color="green">✔ </Text>
          <Text color="magenta">⏺ {msg.tool.name}</Text>
          <Text color="gray">({msg.tool.args})</Text>
        </Text>
        {msg.tool.result.split("\n").map((l, i) => (
          <Text key={i} color="gray">{"  │ " + l}</Text>
        ))}
      </Box>
    );
  }
  return (
    <Text>
      <Text color="cyan" bold>kaleid › </Text>
      {msg.text}
    </Text>
  );
}

function App() {
  const [history, setHistory] = useState<Msg[]>([]); // 进 <Static>，永不重绘
  const [streaming, setStreaming] = useState<string | null>(null); // 动态区：正在流式的 assistant 文本
  const [status, setStatus] = useState<string | null>(null); // 动态区：thinking / running
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  const commit = (m: Omit<Msg, "id">) => setHistory((h) => [...h, { ...m, id: nextId() }]);

  async function streamAssistant(full: string) {
    setStatus(null);
    let acc = "";
    for (const ch of full) {
      acc += ch;
      setStreaming(acc); // 仅动态区重渲染
      await sleep(12);
    }
    setStreaming(null);
    commit({ role: "assistant", text: full }); // 完成 → 进 Static，停止重绘
  }

  async function handleTurn(userText: string) {
    setBusy(true);
    commit({ role: "user", text: userText });

    setStatus("thinking…");
    await sleep(500);
    await streamAssistant("收到。我先看一下当前目录，然后给你结论。");

    setStatus("running bash(ls -la)…");
    await sleep(1400);
    setStatus(null);
    commit({ role: "tool", text: "", tool: { name: "bash", args: "ls -la", result: "app.tsx\npackage.json\nREADME.md" } });

    setStatus("thinking…");
    await sleep(400);
    await streamAssistant("目录里有 3 个文件，app.tsx 是入口。还要我做别的吗？");

    setBusy(false);
  }

  const onSubmit = (val: string) => {
    const line = val.trim();
    setInput("");
    if (!line || busy) return;
    if (line === "exit" || line === "quit") { process.exit(0); }
    void handleTurn(line);
  };

  return (
    <Box flexDirection="column">
      {/* 历史区：渲染一次，永不重绘 → 无闪烁 */}
      <Static items={history}>
        {(msg) => (
          <Box key={msg.id} marginBottom={msg.role === "tool" ? 1 : 0}>
            <MessageView msg={msg} />
          </Box>
        )}
      </Static>

      {/* 动态区：只有正在流式的消息 / 状态 / 输入框 */}
      {streaming !== null && (
        <Text>
          <Text color="cyan" bold>kaleid › </Text>
          {streaming}
        </Text>
      )}
      {status !== null && (
        <Text color="yellow">
          <Spinner type="dots" /> <Text dimColor>{status}</Text>
        </Text>
      )}
      {!busy && (
        <Box>
          <Text color="green" bold>you › </Text>
          <TextInput value={input} onChange={setInput} onSubmit={onSubmit} />
        </Box>
      )}
    </Box>
  );
}

render(<App />);
