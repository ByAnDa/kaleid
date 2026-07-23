// kaleid TUI demo — 方案 2: readline + ANSI（零依赖）
//
// 防闪原则：
//   1. 输出纯追加 —— assistant 文本直接 write 到 stdout，终端自然下滚，从不清屏。
//   2. spinner 只用 \r 覆盖它自己那一行；结束时 \r\x1b[K 清掉该行。
//   3. 输入与输出严格分轮（先读输入、submit 后再流式输出），
//      规避 readline 输入行被并发流式文字冲乱的经典坑。
//
// 跑法: node app.mjs   （在真实终端里跑；也支持管道输入做冒烟）

import readline from "node:readline";
import { stdin as input, stdout as output } from "node:process";

// ---- ANSI 小工具 ----
const C = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  magenta: "\x1b[35m",
  gray: "\x1b[90m",
};
const clearLine = "\r\x1b[K"; // 回到行首并清到行尾
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- 角色行前缀 ----
function userLabel() { return `${C.green}${C.bold}you ›${C.reset} `; }
function asstLabel() { return `${C.cyan}${C.bold}kaleid ›${C.reset} `; }

// ---- 流式打印 assistant 文本（逐字 write，不清屏）----
async function streamAssistant(text) {
  output.write(asstLabel());
  for (const ch of text) {
    output.write(ch);
    await sleep(12); // 模拟 LLM token 流
  }
  output.write("\n");
}

// ---- 工具调用可视化：spinner 只覆盖自己那一行 ----
const SPIN = ["⠋","⠙","⠹","⠸","⠼","⠴","⠦","⠧","⠇","⠏"];
async function runToolWithSpinner(toolName, args, durationMs, result) {
  let i = 0;
  const label = `${C.magenta}⏺ ${toolName}${C.reset}${C.gray}(${args})${C.reset}`;
  const timer = setInterval(() => {
    output.write(`${clearLine}${C.yellow}${SPIN[i++ % SPIN.length]}${C.reset} ${label} ${C.dim}running…${C.reset}`);
  }, 80);
  await sleep(durationMs);
  clearInterval(timer);
  // 收尾：清掉 spinner 行，打最终结果（追加）
  output.write(`${clearLine}${C.green}✔${C.reset} ${label}\n`);
  for (const line of result.split("\n")) {
    output.write(`${C.gray}  │ ${line}${C.reset}\n`);
  }
}

// ---- 状态提示（一行内覆盖刷新，结束清掉）----
async function showStatus(textSeq) {
  for (const [txt, ms] of textSeq) {
    output.write(`${clearLine}${C.dim}● ${txt}${C.reset}`);
    await sleep(ms);
  }
  output.write(clearLine); // 清掉状态行
}

// ---- 一轮 agent 交互（假数据，演示渲染）----
// 注：用户输入行已由 readline 在 prompt 后回显，这里不重复打印。
async function handleTurn(userText) {
  await showStatus([["thinking…", 500]]);
  await streamAssistant(`收到。我先看一下当前目录，然后给你结论。`);
  await runToolWithSpinner("bash", "ls -la", 1400, "app.mjs\npackage.json\nREADME.md");
  await showStatus([["thinking…", 400]]);
  await streamAssistant(`目录里有 3 个文件，app.mjs 是入口。还要我做别的吗？`);
  output.write("\n");
}

function main() {
  output.write(`${C.bold}kaleid TUI demo — readline + ANSI${C.reset}  ${C.dim}(输入消息回车；exit 退出)${C.reset}\n\n`);
  const rl = readline.createInterface({ input, output });
  rl.setPrompt(userLabel());
  rl.prompt();

  rl.on("line", async (raw) => {
    const line = raw.trim();
    if (line === "exit" || line === "quit") { rl.close(); return; }
    if (!line) { rl.prompt(); return; }
    rl.pause(); // 流式期间暂停读输入 —— 输入与输出分轮，杜绝输入行被冲乱
    output.write("\n");
    await handleTurn(line);
    rl.prompt();
    rl.resume();
  });

  rl.on("close", () => {
    output.write(`${C.dim}bye.${C.reset}\n`);
    process.exit(0);
  });
}

main();
