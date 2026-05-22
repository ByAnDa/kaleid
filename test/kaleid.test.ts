import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough, Writable } from "node:stream";
import test from "node:test";
import { parseArgs } from "../src/cli/args.js";
import { runCli } from "../src/cli/run.js";
import { decodeAccountId, login, refresh, systemOpenBrowser } from "../src/auth/oauth.js";
import { getApiKey, loadConfig, saveApiKey, clearApiKeys } from "../src/auth/config-store.js";
import { ensureValid, load, NotLoggedInError, save, type Creds } from "../src/auth/token-store.js";
import {
  buildChatCompletionBody,
  OpenAICompatProvider,
  parseChatCompletionsSSE
} from "../src/provider/openai-compat.js";
import { buildRequestBody } from "../src/provider/responses-encode.js";
import { parseResponsesSSE } from "../src/provider/responses-sse.js";
import { OpenAICodexProvider } from "../src/provider/openai-codex.js";
import {
  AVAILABLE_MODELS,
  DEEPSEEK_FALLBACK_MODELS,
  DEFAULT_MODEL,
  DEFAULT_REASONING_EFFORT,
  getModelContextWindow,
  KIMI_MODELS,
  REASONING_LEVELS,
  getProviderForModel,
  getModelOptions
} from "../src/provider/models.js";
import {
  DEEPSEEK_BASE_URL,
  createProviderForModel,
  fetchDeepSeekModels,
  getAuthenticatedModels
} from "../src/provider/registry.js";
import type { ChatParams, LLMProvider, StreamEvent } from "../src/provider/types.js";
import { runTurn } from "../src/loop/agent-loop.js";
import { createSession } from "../src/loop/session.js";
import { COMPACTION_SUMMARY_PREFIX } from "../src/loop/compaction.js";
import {
  filterSessions,
  formatSessionDisplayName,
  listSessionMetadataOptions,
  listSessions,
  loadSessionData,
  normalizeSessionLabels,
  type SessionSummary
} from "../src/loop/session-store.js";
import { bashTool } from "../src/tools/bash.js";
import { executeBash } from "../src/tools/bash-executor.js";
import { editTool } from "../src/tools/edit.js";
import { readTool } from "../src/tools/read.js";
import { writeTool } from "../src/tools/write.js";
import {
  getSlashCommandCompletions,
  parseChatLabelCommandArgs,
  parseProjectCommandArgs,
  parseRenameCommandArgs,
  parseSlash,
  runSlashCommand
} from "../src/tui/commands.js";
import {
  buildChatLabelComboboxOptions,
  buildProjectComboboxOptions,
  buildResumeLabelFilterOptions,
  buildResumeProjectFilterOptions,
  buildResumeSelectorOptions,
  applySelectorTransition,
  cancelSelectorTransition,
  CLEAR_PROJECT_OPTION_ID,
  CLEAR_RESUME_FILTER_OPTION_ID,
  EMPTY_RESUME_OPTION_ID,
  formatResumeFilterValue,
  getRenameInputPrefill,
  parseRenameInputValue,
  RENAME_INPUT_PROMPT,
  resumeToOption,
  resolveComboboxSubmission,
  resolveRenameSlashAction,
  resolveSlashEnterSubmission
} from "../src/tui/app.js";
import {
  buildConversationEntries,
  estimateConversationRows,
  getVisibleConversationEntries
} from "../src/tui/components/Conversation.js";
import { buildWelcomeIntroText, formatHeaderState, truncateHeaderState } from "../src/tui/components/Header.js";
import { formatTokenStatus, getInputBarHeight, truncateConversationLabel } from "../src/tui/components/InputBar.js";
import { formatMessageRows, getMessageStyle } from "../src/tui/components/Message.js";
import { ROLE_GUTTER_SYMBOL } from "../src/tui/components/RoleGutter.js";
import { buildStatusLineLayout, formatStatusModel } from "../src/tui/components/StatusLine.js";
import { getProjectTokenName, getTagTokenName } from "../src/tui/components/Badges.js";
import {
  MULTILINE_INPUT_NEWLINE_HINT,
  getMultilineInputRows,
  normalizeInputText,
  shouldInsertInputNewline
} from "../src/tui/components/MultilineInput.js";
import { formatOptionComboboxLine, getOptionComboboxHeight } from "../src/tui/components/OptionCombobox.js";
import { formatOptionSelectorLine, getOptionSelectorHeight } from "../src/tui/components/OptionSelector.js";
import {
  formatResumeActivity,
  formatResumeFilterChipLabel,
  getResumeSelectorHeight
} from "../src/tui/components/ResumeSelector.js";
import { formatToolCallLine } from "../src/tui/components/ToolCall.js";
import {
  DEFAULT_RESOLVED_THEME,
  daylightTheme,
  detectTerminalAppearance,
  detectTerminalColorLevel,
  getResolvedTheme,
  nearestAnsi256Color,
  nearestAnsiColor,
  spectrumTheme,
  type TuiTheme,
  themeNameForMode
} from "../src/tui/theme/index.js";
import { textWidth } from "../src/tui/components/text-width.js";
import {
  ALT_SCREEN_ENTER,
  ALT_SCREEN_EXIT,
  INK_CLEAR_TERMINAL,
  createDiffingTerminalOutput,
  enterAlternateScreen
} from "../src/tui/terminal.js";
import type { Msg } from "../src/tui/types.js";

function fakeJwt(accountId: string): string {
  const header = Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({ "https://api.openai.com/auth": { chatgpt_account_id: accountId } })
  ).toString("base64url");
  return `${header}.${payload}.sig`;
}

async function withTempAuthFile<T>(fn: (file: string) => Promise<T>): Promise<T> {
  const old = process.env.KALEID_AUTH_FILE;
  const dir = await mkdtemp(join(tmpdir(), "kaleid-auth-"));
  const file = join(dir, "auth.json");
  process.env.KALEID_AUTH_FILE = file;
  try {
    return await fn(file);
  } finally {
    if (old === undefined) {
      delete process.env.KALEID_AUTH_FILE;
    } else {
      process.env.KALEID_AUTH_FILE = old;
    }
    await rm(dir, { recursive: true, force: true });
  }
}

async function withTempConfigFile<T>(fn: (file: string) => Promise<T>): Promise<T> {
  const oldConfig = process.env.KALEID_CONFIG_FILE;
  const oldDeepSeek = process.env.DEEPSEEK_API_KEY;
  const oldKimi = process.env.KIMI_API_KEY;
  const dir = await mkdtemp(join(tmpdir(), "kaleid-config-"));
  const file = join(dir, "config.json");
  process.env.KALEID_CONFIG_FILE = file;
  delete process.env.DEEPSEEK_API_KEY;
  delete process.env.KIMI_API_KEY;
  try {
    return await fn(file);
  } finally {
    if (oldConfig === undefined) {
      delete process.env.KALEID_CONFIG_FILE;
    } else {
      process.env.KALEID_CONFIG_FILE = oldConfig;
    }
    if (oldDeepSeek === undefined) {
      delete process.env.DEEPSEEK_API_KEY;
    } else {
      process.env.DEEPSEEK_API_KEY = oldDeepSeek;
    }
    if (oldKimi === undefined) {
      delete process.env.KIMI_API_KEY;
    } else {
      process.env.KIMI_API_KEY = oldKimi;
    }
    await rm(dir, { recursive: true, force: true });
  }
}

async function withTempSessions<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const old = process.env.KALEID_SESSIONS_DIR;
  const dir = await mkdtemp(join(tmpdir(), "kaleid-sessions-"));
  process.env.KALEID_SESSIONS_DIR = dir;
  try {
    return await fn(dir);
  } finally {
    if (old === undefined) {
      delete process.env.KALEID_SESSIONS_DIR;
    } else {
      process.env.KALEID_SESSIONS_DIR = old;
    }
    await rm(dir, { recursive: true, force: true });
  }
}

function streamFromString(value: string): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      const midpoint = Math.floor(value.length / 2);
      controller.enqueue(new TextEncoder().encode(value.slice(0, midpoint)));
      controller.enqueue(new TextEncoder().encode(value.slice(midpoint)));
      controller.close();
    }
  });
}

async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const result: T[] = [];
  for await (const item of iterable) {
    result.push(item);
  }
  return result;
}

test("parseArgs selects explicit commands, one-shot prompts, and model override", () => {
  assert.equal(parseArgs(["--model", "gpt-x", "-p", "hello"]).model, "gpt-x");
  assert.deepEqual(parseArgs(["fix", "tests"]).command, "oneshot");
  assert.equal(parseArgs([]).command, "repl");
  assert.deepEqual(parseArgs(["--continue"]).resume, { kind: "latest" });
  assert.deepEqual(parseArgs(["--resume"]).resume, { kind: "select" });
  assert.deepEqual(parseArgs(["--resume", "session_1"]).resume, { kind: "id", id: "session_1" });
  assert.throws(() => parseArgs(["login"]), /Unknown command: login/u);
  assert.throws(() => parseArgs(["logout"]), /Unknown command: logout/u);
});

test("model and reasoning constants expose selectable defaults", () => {
  assert.equal(DEFAULT_MODEL, "gpt-5.5");
  assert.equal(DEFAULT_REASONING_EFFORT, "medium");
  assert.deepEqual(
    AVAILABLE_MODELS.map((model) => model.id),
    [
      "o4-mini-deep-research",
      "gpt-5.2",
      "gpt-5.3-codex",
      "gpt-5.3-codex-spark",
      "gpt-5.4",
      "gpt-5.4-mini",
      "gpt-5.5"
    ]
  );
  assert.ok(AVAILABLE_MODELS.some((model) => model.id === DEFAULT_MODEL));
  assert.equal(AVAILABLE_MODELS.at(-1)?.id, DEFAULT_MODEL);
  assert.ok(AVAILABLE_MODELS.every((model) => model.label === "[openai-codex]"));
  assert.ok(AVAILABLE_MODELS.every((model) => model.provider === "openai-codex"));
  assert.equal(AVAILABLE_MODELS.some((model) => model.id === "gpt-5.5-pro"), false);
  assert.equal(AVAILABLE_MODELS.some((model) => model.id === "gpt-5.2-codex"), false);
  assert.equal(getModelContextWindow(DEFAULT_MODEL), 272000);
  assert.equal(getModelContextWindow("unknown-model"), 128000);
  assert.equal(getProviderForModel("deepseek-reasoner"), "deepseek");
  assert.equal(getProviderForModel("kimi-for-coding"), "kimi");
  assert.deepEqual(REASONING_LEVELS, ["minimal", "low", "medium", "high", "xhigh"]);
  assert.equal(getModelOptions("custom-model")[0]?.id, "custom-model");
  assert.equal(getModelOptions("custom-model")[0]?.label, "custom");
});

test("runCli starts the REPL without requiring login", async () => {
  let ensured = false;
  let replCwd = "";
  const code = await runCli(
    [],
    {
      packageVersion: "0.0.1",
      ensureValid: async () => {
        ensured = true;
        throw new NotLoggedInError();
      },
      runOneShot: async () => {
        throw new Error("one-shot should not run");
      },
      runRepl: (options) => {
        replCwd = options.cwd;
      }
    },
    { cwd: "/tmp/kaleid" }
  );

  assert.equal(code, 0);
  assert.equal(ensured, false);
  assert.equal(replCwd, "/tmp/kaleid");
});

test("runCli tells unauthenticated one-shot users to use REPL /login", async () => {
  const stderrChunks: string[] = [];
  let ranOneShot = false;

  const code = await runCli(
    ["fix", "tests"],
    {
      packageVersion: "0.0.1",
      ensureValid: async () => {
        throw new NotLoggedInError();
      },
      runOneShot: async () => {
        ranOneShot = true;
        return 0;
      },
      runRepl: () => undefined
    },
    {
      stderr: {
        write(chunk) {
          stderrChunks.push(String(chunk));
          return true;
        }
      }
    }
  );

  assert.equal(code, 1);
  assert.equal(ranOneShot, false);
  assert.match(stderrChunks.join(""), /`kaleid`.*`\/login`/u);
});

test("slash command parser and dispatcher handle help, unknown, logout, and login", async () => {
  assert.equal(parseSlash("write tests"), null);
  assert.equal(parseSlash("  /help now "), null);
  assert.deepEqual(parseSlash("/help now "), { command: "/help", args: ["now"] });
  assert.deepEqual(getSlashCommandCompletions("/")?.map((command) => command.command), [
    "/login",
    "/logout",
    "/model",
    "/reasoning",
    "/compact",
    "/resume",
    "/rename",
    "/project",
    "/chatlabel",
    "/theme",
    "/exit",
    "/help"
  ]);
  assert.deepEqual(getSlashCommandCompletions("/lo")?.map((command) => command.command), ["/login", "/logout"]);
  assert.deepEqual(getSlashCommandCompletions("/mo")?.map((command) => command.command), ["/model"]);
  assert.deepEqual(getSlashCommandCompletions("/nope"), []);
  assert.equal(getSlashCommandCompletions("plain /"), null);
  assert.equal(getSlashCommandCompletions("/login now"), null);
  assert.equal(resolveSlashEnterSubmission("/he", getSlashCommandCompletions("/he") ?? [], 0), "/help");
  assert.equal(resolveSlashEnterSubmission("/lo", getSlashCommandCompletions("/lo") ?? [], 1), "/logout");
  assert.equal(resolveSlashEnterSubmission("/nope", getSlashCommandCompletions("/nope") ?? [], -1), "/nope");

  const help = await runSlashCommand({ command: "/help", args: [] });
  assert.equal(help.action, "continue");
  assert.match(help.messages[0] ?? "", /\/login/u);
  assert.match(help.messages[0] ?? "", /\/logout/u);
  assert.match(help.messages[0] ?? "", /\/model/u);
  assert.match(help.messages[0] ?? "", /\/reasoning/u);
  assert.match(help.messages[0] ?? "", /\/compact/u);
  assert.match(help.messages[0] ?? "", /\/resume/u);
  assert.match(help.messages[0] ?? "", /\/rename/u);
  assert.match(help.messages[0] ?? "", /\/project/u);
  assert.match(help.messages[0] ?? "", /\/chatlabel/u);
  assert.match(help.messages[0] ?? "", /\/theme/u);
  assert.match(help.messages[0] ?? "", /\/exit/u);
  assert.match(help.messages[0] ?? "", /\/help/u);
  assert.deepEqual(parseRenameCommandArgs(["我的重构任务"]), { name: "我的重构任务" });
  assert.deepEqual(parseRenameCommandArgs(["kaleid/修复", "登录"]), { project: "kaleid", name: "修复 登录" });
  assert.deepEqual(parseRenameCommandArgs(["/无项目名称"]), { project: null, name: "无项目名称" });
  assert.equal(parseRenameCommandArgs([]), null);
  assert.equal(parseRenameCommandArgs(["kaleid/"]), null);
  assert.equal(RENAME_INPUT_PROMPT, "输入对话名称（可 项目/名称）：");
  assert.equal(getRenameInputPrefill({ name: "当前名称" }), "当前名称");
  assert.deepEqual(resolveRenameSlashAction([], "当前名称"), { kind: "input", initialValue: "当前名称" });
  assert.deepEqual(resolveRenameSlashAction(["新名称"], "当前名称"), { kind: "rename", rename: { name: "新名称" } });
  assert.deepEqual(resolveRenameSlashAction(["kaleid/"], "当前名称"), { kind: "invalid" });
  assert.deepEqual(parseRenameInputValue("kaleid/修复 登录"), { project: "kaleid", name: "修复 登录" });
  assert.deepEqual(parseRenameInputValue("/无项目名称"), { project: null, name: "无项目名称" });
  assert.deepEqual(parseProjectCommandArgs(["kaleid", "cli"]), { project: "kaleid cli" });
  assert.equal(parseProjectCommandArgs([]), null);
  assert.deepEqual(parseChatLabelCommandArgs(["bug"]), { action: "add", label: "bug" });
  assert.deepEqual(parseChatLabelCommandArgs(["new", "ui"]), { action: "add", label: "new ui" });
  assert.deepEqual(parseChatLabelCommandArgs(["remove", "bug"]), { action: "remove", label: "bug" });
  assert.equal(parseChatLabelCommandArgs(["remove"]), null);

  const unknown = await runSlashCommand({ command: "/wat", args: [] });
  assert.deepEqual(unknown.messages, ["unknown command: /wat\nRun /help to see available slash commands."]);

  let loggedOut = false;
  const logoutResult = await runSlashCommand(
    { command: "/logout", args: [] },
    {
      logout: async () => {
        loggedOut = true;
      }
    }
  );
  assert.equal(loggedOut, true);
  assert.match(logoutResult.messages[0] ?? "", /已登出/u);

  const freshCreds: Creds = {
    access: "access",
    refresh: "refresh",
    expires: Date.now() + 1000,
    accountId: "acct_new"
  };
  let saved: Creds | null = null;
  const loginResult = await runSlashCommand(
    { command: "/login", args: [] },
    {
      load: async () => ({
        access: "old",
        refresh: "old_refresh",
        expires: Date.now() + 1000,
        accountId: "acct_old"
      }),
      login: async () => freshCreds,
      save: async (creds) => {
        saved = creds;
      }
    }
  );

  assert.equal(saved, freshCreds);
  assert.match(loginResult.messages.join("\n"), /已登录 OpenAI Codex 为 acct_old/u);
  assert.match(loginResult.messages.join("\n"), /已登录: openai-codex \(acct_new\)/u);
});

test("slash login forwards OAuth callbacks and saves the returned credentials", async () => {
  const freshCreds: Creds = {
    access: "access",
    refresh: "refresh",
    expires: Date.now() + 1000,
    accountId: "acct_callback"
  };
  const events: string[] = [];
  let saved: Creds | null = null;
  const loginOptions = {
    onAuthUrl: (url: string) => events.push(`url:${url}`),
    onStatus: (message: string) => events.push(`status:${message}`),
    getManualCode: async () => {
      events.push("manual");
      return "manual_code";
    }
  };

  const result = await runSlashCommand(
    { command: "/login", args: [] },
    {
      load: async () => null,
      loginOptions,
      login: async (options) => {
        assert.equal(options, loginOptions);
        options?.onAuthUrl?.("https://auth.example/");
        options?.onStatus?.("waiting");
        assert.equal(await options?.getManualCode?.(), "manual_code");
        return freshCreds;
      },
      save: async (creds) => {
        saved = creds;
      }
    }
  );

  assert.equal(saved, freshCreds);
  assert.deepEqual(events, ["url:https://auth.example/", "status:waiting", "manual"]);
  assert.deepEqual(result.messages, ["已登录: openai-codex (acct_callback)"]);
});

test("TUI fullscreen helpers enter and restore alternate screen for TTY output", () => {
  const chunks: string[] = [];
  const restore = enterAlternateScreen({
    isTTY: true,
    write: (chunk) => {
      chunks.push(chunk);
    }
  });

  assert.deepEqual(chunks, [ALT_SCREEN_ENTER]);
  restore();
  restore();
  assert.deepEqual(chunks, [ALT_SCREEN_ENTER, ALT_SCREEN_EXIT]);

  const nonTtyChunks: string[] = [];
  const noopRestore = enterAlternateScreen({
    isTTY: false,
    write: (chunk) => {
      nonTtyChunks.push(chunk);
    }
  });
  noopRestore();
  assert.deepEqual(nonTtyChunks, []);
});

test("TUI renderer patches changed rows without forwarding Ink full clears", () => {
  const chunks: string[] = [];
  const target = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(String(chunk));
      callback();
    }
  }) as NodeJS.WriteStream;
  Object.defineProperties(target, {
    columns: { value: 40 },
    isTTY: { value: true },
    rows: { value: 4 }
  });

  const output = createDiffingTerminalOutput(target);
  output.write(`${INK_CLEAR_TERMINAL}kaleid\nconversation\nstatus\ninput`);

  const firstFrame = chunks.join("");
  assert.doesNotMatch(firstFrame, /\x1b\[2J|\x1b\[3J/u);
  assert.match(firstFrame, /kaleid/u);
  assert.match(firstFrame, /conversation/u);
  assert.match(firstFrame, /status/u);
  assert.match(firstFrame, /input/u);

  chunks.length = 0;
  output.write(`${INK_CLEAR_TERMINAL}kaleid\nconversation changed\nstatus\ninput`);

  const secondFrame = chunks.join("");
  assert.doesNotMatch(secondFrame, /\x1b\[2J|\x1b\[3J/u);
  assert.doesNotMatch(secondFrame, /kaleid/u);
  assert.match(secondFrame, /\x1b\[2;1H\x1b\[2Kconversation changed/u);
  assert.doesNotMatch(secondFrame, /status/u);
  assert.doesNotMatch(secondFrame, /input/u);

  chunks.length = 0;
  output.write(`${INK_CLEAR_TERMINAL}kaleid\nconversation changed\nstatus\ninput`);
  assert.equal(chunks.join(""), "");
});

test("TUI conversation keeps newest messages pinned to the bottom", () => {
  const messages: Msg[] = Array.from({ length: 6 }, (_, index) => ({
    id: `m${index + 1}`,
    role: index % 2 === 0 ? "user" : "assistant",
    text: `message ${index + 1}`
  }));

  const visible = getVisibleConversationEntries(buildConversationEntries(messages, null), 5, 40);
  assert.deepEqual(visible.map((entry) => entry.id), ["m4", "m5", "m6"]);
  assert.equal(estimateConversationRows(visible, 40), 5);

  const withStreaming = getVisibleConversationEntries(buildConversationEntries(messages, "streaming answer"), 3, 40);
  assert.deepEqual(withStreaming.map((entry) => entry.id), ["m6", "streaming"]);

  const trimmed = getVisibleConversationEntries(buildConversationEntries([], "line 1\nline 2\nline 3"), 2, 40);
  assert.equal(trimmed[0]?.kind, "streaming");
  assert.equal(trimmed[0]?.kind === "streaming" ? trimmed[0].text : "", "line 2\nline 3");

  const wrappedRows = formatMessageRows("abcdef", "you", 8);
  assert.deepEqual(wrappedRows, [
    { label: "you ", text: "ab" },
    { label: "    ", text: "cd" },
    { label: "    ", text: "ef" }
  ]);
  assert.equal(
    estimateConversationRows(buildConversationEntries([{ id: "wrapped", role: "user", text: "abcdef" }], null), 8),
    wrappedRows.length
  );
});

test("TUI message labels and tool calls use distinct visual roles", () => {
  const theme = DEFAULT_RESOLVED_THEME;
  assert.deepEqual(getMessageStyle("user"), {
    label: "you",
    color: theme.role.user.fg,
    textColor: theme.text.primary,
    gutter: theme.role.user.gutter,
    bold: true
  });
  assert.deepEqual(getMessageStyle("assistant"), {
    label: "kaleid",
    color: theme.role.assistant.fg,
    textColor: theme.text.primary,
    gutter: theme.role.assistant.gutter
  });
  assert.deepEqual(getMessageStyle("system"), {
    label: "system",
    color: theme.role.system.fg,
    textColor: theme.text.primary,
    gutter: theme.role.system.gutter,
    dimColor: true
  });
  assert.equal(ROLE_GUTTER_SYMBOL, "▏");

  const success = formatToolCallLine(
    { name: "bash", args: { command: "npm test" }, resultSummary: "passed" },
    80
  );
  assert.match(success, /^⏺ bash\(/u);
  assert.match(success, /✔ passed/u);

  const failure = formatToolCallLine(
    { name: "read", args: { path: "missing.txt" }, resultSummary: "not found", isError: true },
    80
  );
  assert.match(failure, /✘ not found/u);

  const tightToolLine = formatToolCallLine(
    {
      name: "very-long-command-name",
      args: { path: "a".repeat(40) },
      resultSummary: "b".repeat(40)
    },
    20
  );
  assert.ok(textWidth(tightToolLine) <= 20);
});

function designTokenSnapshot(theme: TuiTheme) {
  const { system, user, assistant, tool } = theme.role;
  return {
    gutterStyle: theme.gutterStyle,
    surface: theme.surface,
    text: theme.text,
    border: theme.border,
    accent: theme.accent,
    role: { system, user, assistant, tool },
    status: theme.status,
    tag: theme.tag,
    project: theme.project,
    selection: theme.selection
  };
}

test("TUI themes match the committed kaleid design tokens", () => {
  assert.deepEqual(designTokenSnapshot(daylightTheme), {
    gutterStyle: "thin",
    surface: {
      canvas: "#f6f3ea",
      panel: "#fbf8ee",
      raised: "#fdfaef",
      chrome: "#ece5d2"
    },
    text: {
      primary: "#28241b",
      secondary: "#4a4537",
      muted: "#857e6d",
      subtle: "#a8a190",
      faint: "#cfc8b5",
      onChrome: "#5d564a"
    },
    border: {
      strong: "#bdb5a0",
      default: "#dbd4c1",
      subtle: "#e8e1cc"
    },
    accent: {
      default: "#b8431a",
      soft: "#e8d2c0",
      on: "#fbf8ee"
    },
    role: {
      system: { fg: "#857e6d", gutter: "#bdb5a0" },
      user: { fg: "#0e547d", gutter: "#0e547d" },
      assistant: { fg: "#7b2c10", gutter: "#b8431a" },
      tool: { fg: "#6a4a0a", gutter: "#a17612" }
    },
    status: {
      ok: "#1f5e36",
      warn: "#a17612",
      err: "#8e2222",
      info: "#0e547d"
    },
    tag: {
      review: { bg: "#d5e6f3", fg: "#0c4670" },
      wip: { bg: "#f1e1bb", fg: "#7a5b0d" },
      design: { bg: "#efd9e6", fg: "#86234a" },
      infra: { bg: "#cee8d5", fg: "#1f5e36" },
      planning: { bg: "#e1dbef", fg: "#4c2e95" },
      refactor: { bg: "#f0d6d6", fg: "#8e2222" },
      docs: { bg: "#d6e6c8", fg: "#3d5a1e" },
      inbox: { bg: "#dfd7c2", fg: "#5d564a" }
    },
    project: {
      kaleid: { bg: "#e1dbef", fg: "#4c2e95" },
      "web-app": { bg: "#d5e6f3", fg: "#0c4670" },
      research: { bg: "#f1e1bb", fg: "#7a5b0d" },
      personal: { bg: "#cee8d5", fg: "#1f5e36" }
    },
    selection: { bg: "#e8d2c0", fg: "#28241b" }
  });

  assert.deepEqual(designTokenSnapshot(spectrumTheme), {
    gutterStyle: "thin",
    surface: {
      canvas: "#0b0b14",
      panel: "#0e0e1a",
      raised: "#15152a",
      chrome: "#1a1a28"
    },
    text: {
      primary: "#e6e3f0",
      secondary: "#a8a3c0",
      muted: "#706c80",
      subtle: "#4a4660",
      faint: "#26243a",
      onChrome: "#94909e"
    },
    border: {
      strong: "#2a283e",
      default: "#1c1c2e",
      subtle: "#22203a"
    },
    accent: {
      default: "#ec4899",
      soft: "#4a1d35",
      on: "#0b0b14"
    },
    role: {
      system: { fg: "#8a8598", gutter: "#3a3550" },
      user: { fg: "#67e8f9", gutter: "#06b6d4" },
      assistant: { fg: "#d8b4fe", gutter: "#a855f7" },
      tool: { fg: "#fde047", gutter: "#eab308" }
    },
    status: {
      ok: "#6ee7b7",
      warn: "#fde047",
      err: "#fca5a5",
      info: "#67e8f9"
    },
    tag: {
      review: { bg: "#0b4456", fg: "#a5f3fc" },
      wip: { bg: "#4a3a0a", fg: "#fde047" },
      design: { bg: "#3a1456", fg: "#d8b4fe" },
      infra: { bg: "#0a3a2e", fg: "#6ee7b7" },
      planning: { bg: "#561234", fg: "#fbcfe8" },
      refactor: { bg: "#56120e", fg: "#fca5a5" },
      docs: { bg: "#173d22", fg: "#bef264" },
      inbox: { bg: "#272538", fg: "#a8a3c0" }
    },
    project: {
      kaleid: { bg: "#3a1456", fg: "#d8b4fe" },
      "web-app": { bg: "#0b3a52", fg: "#67e8f9" },
      research: { bg: "#4a2a0e", fg: "#fdba74" },
      personal: { bg: "#0c3a26", fg: "#86efac" }
    },
    selection: { bg: "#2a1d44", fg: "#e6e3f0" }
  });
});

test("TUI badges resolve design token palettes by semantic name", () => {
  assert.equal(getTagTokenName("#review"), "review");
  assert.equal(getTagTokenName("unknown") in daylightTheme.tag, true);
  assert.equal(getProjectTokenName("kaleid"), "kaleid");
  assert.equal(getProjectTokenName("web-app"), "web-app");
  assert.equal(getProjectTokenName("unknown") in daylightTheme.project, true);
});

test("TUI themes follow terminal appearance and fall back for low-color terminals", () => {
  assert.equal(detectTerminalAppearance({ COLORFGBG: "0;15" } as NodeJS.ProcessEnv), "light");
  assert.equal(detectTerminalAppearance({ COLORFGBG: "15;0" } as NodeJS.ProcessEnv), "dark");
  assert.equal(detectTerminalColorLevel({ COLORTERM: "truecolor" } as NodeJS.ProcessEnv), "truecolor");
  assert.equal(detectTerminalColorLevel({ TERM: "xterm-256color" } as NodeJS.ProcessEnv), "ansi256");
  assert.equal(themeNameForMode("system", "light"), "daylight");
  assert.equal(themeNameForMode("system", "dark"), "spectrum");
  assert.equal(nearestAnsiColor("#000000"), "black");
  assert.match(nearestAnsi256Color("#000000"), /^ansi256\(\d+\)$/u);

  const daylight = getResolvedTheme("system", "light", "truecolor");
  assert.equal(daylight.name, "daylight");
  assert.equal(daylight.surface.canvas, "#f6f3ea");
  assert.equal(daylight.accent.default, "#b8431a");
  assert.equal(daylight.role.user.fg, "#0e547d");
  assert.equal(daylight.project.kaleid.bg, "#e1dbef");

  const ansi256 = getResolvedTheme("spectrum", "dark", "ansi256");
  assert.match(ansi256.role.user.fg, /^ansi256\(\d+\)$/u);
  assert.match(ansi256.project["web-app"].bg, /^ansi256\(\d+\)$/u);

  const lowColor = getResolvedTheme("spectrum", "dark", "ansi16");
  assert.equal(lowColor.name, "spectrum");
  assert.equal(lowColor.gutterStyle, "thin");
  assert.doesNotMatch(lowColor.role.user.fg, /^#/u);
  assert.doesNotMatch(lowColor.tag.docs.bg, /^#/u);
  assert.equal(new Set(Object.values(lowColor.tag).map((tag) => `${tag.bg}/${tag.fg}`)).size, 8);
  assert.equal(new Set(Object.values(lowColor.project).map((project) => `${project.bg}/${project.fg}`)).size, 4);

  const daylightLowColor = getResolvedTheme("daylight", "light", "ansi16");
  assert.equal(daylightLowColor.gutterStyle, "thin");
  assert.notEqual(daylightLowColor.role.tool.fg, daylightLowColor.role.error.fg);
  assert.notEqual(daylightLowColor.status.warn, daylightLowColor.status.err);
  assert.equal(daylightLowColor.surface.canvas, "white");
  assert.equal(lowColor.surface.canvas, "black");
});

test("TUI header and option selector format model and reasoning state", () => {
  assert.equal(formatHeaderState("gpt-5.5", "high"), "gpt-5.5 · high");
  assert.equal(formatHeaderState("kimi-for-coding", null, "kimi"), "kimi-for-coding [kimi] · -");
  assert.equal(truncateHeaderState("gpt-5.5-pro · medium", 12), "gpt-5.5-p...");
  assert.match(buildWelcomeIntroText("gpt-5.5", "high"), /^kaleid v0\.0\.12 · gpt-5\.5 · high/u);
  assert.equal(getOptionSelectorHeight(5), 8);
  assert.equal(getResumeSelectorHeight(5), 8);
  assert.equal(getResumeSelectorHeight(5, true), 9);
  assert.equal(getOptionComboboxHeight(3, ""), 7);
  assert.equal(getOptionComboboxHeight(3, "new"), 4);
  assert.equal(
    formatOptionSelectorLine({ id: "gpt-5.5", current: true }, true),
    "> * gpt-5.5 (current)"
  );
  assert.equal(
    formatOptionComboboxLine({ id: CLEAR_PROJECT_OPTION_ID, display: "(无项目)", current: false }, true),
    ">   (无项目)"
  );
  assert.equal(formatOptionSelectorLine({ id: "high", current: false }, false), "    high");
  assert.equal(
    formatOptionSelectorLine({ id: "session_1", display: "kaleid - 修复登录", current: false }, false),
    "    kaleid - 修复登录"
  );
  assert.equal(formatResumeFilterChipLabel({ id: CLEAR_RESUME_FILTER_OPTION_ID, display: "全部", current: true }, "project"), "all");
  assert.equal(formatResumeFilterChipLabel({ id: "review", current: false }, "label"), "#review");
  assert.equal(
    formatResumeActivity({ messageCount: 12, updatedAt: "2026-05-22T12:00:00.000Z" }, Date.parse("2026-05-22T14:30:00.000Z")),
    "12 msgs · 2h"
  );
  assert.deepEqual(
    resumeToOption({
      id: "session_1",
      title: "kaleid - 修复登录",
      project: "kaleid",
      name: "修复登录",
      labels: ["bug", "urgent"],
      label: "kaleid - 修复登录",
      createdAt: "2026-05-22T00:00:00.000Z",
      updatedAt: "2026-05-22T00:00:00.000Z",
      model: "gpt-5.5",
      messageCount: 2
    }),
    {
      id: "session_1",
      display: "kaleid - 修复登录 · gpt-5.5",
      current: false
    }
  );
  assert.deepEqual(buildProjectComboboxOptions(["work", "kaleid", "work"], "kaleid"), [
    { id: CLEAR_PROJECT_OPTION_ID, display: "(无项目)", current: false },
    { id: "kaleid", current: true },
    { id: "work", current: false }
  ]);
  assert.deepEqual(buildChatLabelComboboxOptions(["bug", "urgent", "#bug"], ["bug"]), [
    { id: "bug", current: true },
    { id: "urgent", current: false }
  ]);
  assert.equal(
    resolveComboboxSubmission("", [{ id: "kaleid", current: false }], 0),
    "kaleid"
  );
  assert.equal(
    resolveComboboxSubmission("new project", [{ id: "kaleid", current: false }], 0),
    "new project"
  );
});

test("resume session filters normalize project and label selections", () => {
  const session = (id: string, project: string | null, labels: string[]): SessionSummary => ({
    id,
    title: id,
    project,
    name: id,
    labels,
    label: formatSessionDisplayName(project, id, labels),
    createdAt: "2026-05-22T00:00:00.000Z",
    updatedAt: "2026-05-22T00:00:00.000Z",
    messageCount: 1
  });
  const sessions = [
    session("kaleid_bug", "kaleid", ["bug", "urgent"]),
    session("kaleid_docs", "kaleid", ["docs"]),
    session("pi_bug", "pi", ["bug"]),
    session("scratch", null, [])
  ];

  assert.equal(formatResumeFilterValue(null), "全部");
  assert.equal(formatResumeFilterValue("kaleid"), "kaleid");
  assert.deepEqual(buildResumeProjectFilterOptions(["pi", "kaleid", "pi"], "kaleid"), [
    { id: CLEAR_RESUME_FILTER_OPTION_ID, display: "全部", current: false },
    { id: "kaleid", current: true },
    { id: "pi", current: false }
  ]);
  assert.deepEqual(buildResumeLabelFilterOptions(["#urgent", "bug", "bug"], "urgent"), [
    { id: CLEAR_RESUME_FILTER_OPTION_ID, display: "全部", current: false },
    { id: "bug", current: false },
    { id: "urgent", current: true }
  ]);

  assert.deepEqual(filterSessions(sessions, { project: "kaleid" }).map((item) => item.id), [
    "kaleid_bug",
    "kaleid_docs"
  ]);
  assert.deepEqual(filterSessions(sessions, { label: "#bug" }).map((item) => item.id), [
    "kaleid_bug",
    "pi_bug"
  ]);
  assert.deepEqual(filterSessions(sessions, { project: "kaleid", label: "bug" }).map((item) => item.id), [
    "kaleid_bug"
  ]);
  assert.deepEqual(filterSessions(sessions, { project: null, label: null }).map((item) => item.id), [
    "kaleid_bug",
    "kaleid_docs",
    "pi_bug",
    "scratch"
  ]);
  assert.deepEqual(filterSessions(sessions, { project: "pi", label: "docs" }), []);
  assert.deepEqual(buildResumeSelectorOptions(sessions, { project: "pi", label: "docs" }), [
    {
      id: EMPTY_RESUME_OPTION_ID,
      display: "无匹配会话",
      current: false,
      disabled: true
    }
  ]);
  assert.equal(buildResumeSelectorOptions(sessions, { project: "pi", label: "bug" })[0]?.id, "pi_bug");
});

test("TUI selector transitions chain model selection into reasoning effort", () => {
  const modelStep = applySelectorTransition({
    activeSelector: "model",
    selectorFlow: "modelEffortChain",
    selectedId: "gpt-5.4",
    currentModel: "gpt-5.5",
    reasoningEffort: "medium"
  });

  assert.deepEqual(modelStep, {
    currentModel: "gpt-5.4",
    reasoningEffort: "medium",
    nextSelector: "reasoning",
    nextSelectorFlow: "modelEffortChain",
    message: null
  });

  const effortStep = applySelectorTransition({
    activeSelector: "reasoning",
    selectorFlow: modelStep.nextSelectorFlow,
    selectedId: "high",
    currentModel: modelStep.currentModel,
    reasoningEffort: modelStep.reasoningEffort
  });

  assert.deepEqual(effortStep, {
    currentModel: "gpt-5.4",
    reasoningEffort: "high",
    nextSelector: null,
    nextSelectorFlow: "standalone",
    message: "已设置: gpt-5.4 · high"
  });
});

test("TUI selector skips reasoning effort for non-Codex providers", () => {
  const modelStep = applySelectorTransition({
    activeSelector: "model",
    selectorFlow: "modelEffortChain",
    selectedId: "deepseek-v4-pro",
    selectedProvider: "deepseek",
    currentModel: "gpt-5.5",
    reasoningEffort: "medium"
  });

  assert.deepEqual(modelStep, {
    currentModel: "deepseek-v4-pro",
    reasoningEffort: "medium",
    nextSelector: null,
    nextSelectorFlow: "standalone",
    message: "已设置模型: deepseek-v4-pro [deepseek]; 推理强度 N/A"
  });
});

test("TUI selector Esc keeps chained model and standalone reasoning only changes effort", () => {
  const skippedEffort = cancelSelectorTransition({
    activeSelector: "reasoning",
    selectorFlow: "modelEffortChain",
    currentModel: "gpt-5.4-mini",
    reasoningEffort: "medium"
  });

  assert.deepEqual(skippedEffort, {
    currentModel: "gpt-5.4-mini",
    reasoningEffort: "medium",
    nextSelector: null,
    nextSelectorFlow: "standalone",
    message: "已设置模型: gpt-5.4-mini; 推理强度保持 medium"
  });

  const standaloneReasoning = applySelectorTransition({
    activeSelector: "reasoning",
    selectorFlow: "standalone",
    selectedId: "low",
    currentModel: "gpt-5.5",
    reasoningEffort: "medium"
  });

  assert.deepEqual(standaloneReasoning, {
    currentModel: "gpt-5.5",
    reasoningEffort: "low",
    nextSelector: null,
    nextSelectorFlow: "standalone",
    message: "已切换推理强度: low"
  });
});

test("TUI input footer reserves rows for status, slash menu, and OAuth paste mode", () => {
  assert.equal(
    getInputBarHeight({ manualCodePrompt: null, slashCommandCount: 4, slashMenuVisible: false, status: null }),
    5
  );
  assert.equal(
    getInputBarHeight({
      input: "line one\nline two",
      width: 88,
      manualCodePrompt: null,
      slashCommandCount: 0,
      slashMenuVisible: false,
      status: null
    }),
    6
  );
  assert.equal(
    getInputBarHeight({ manualCodePrompt: null, slashCommandCount: 4, slashMenuVisible: true, status: null }),
    9
  );
  assert.equal(
    getInputBarHeight({
      manualCodePrompt: "粘贴 OAuth code 或回调 URL，回车提交",
      slashCommandCount: 0,
      slashMenuVisible: true,
      status: "waiting"
    }),
    7
  );
  assert.equal(formatStatusModel("gpt-5.5", "high"), "gpt-5.5 · high");
  const statusLayout = buildStatusLineLayout(
    {
      busyStatus: null,
      conversationName: "conversation with a long visible name",
      labels: ["review"],
      model: "gpt-5.5",
      project: "kaleid",
      reasoningEffort: "high"
    },
    44
  );
  assert.equal(statusLayout.fallbackText, null);
  assert.match(statusLayout.name, /…$/u);
  assert.equal(statusLayout.project, "kaleid");
  assert.deepEqual(statusLayout.labels, ["review"]);
  assert.equal(statusLayout.modelState, "gpt-5.5 · high");
  assert.ok(statusLayout.width <= 44);
  assert.equal(
    formatTokenStatus({
      usedTokens: 12345,
      contextWindow: 272000,
      percent: 4.538,
      warning: false,
      source: "estimate",
      model: "gpt-5.5",
      reserveTokens: 16384,
      keepRecentTokens: 20000,
      updatedAt: "now"
    }),
    "ctx 12.3K / 272K · 4.5%"
  );
  assert.equal(formatSessionDisplayName(null, "修复登录"), "修复登录");
  assert.equal(formatSessionDisplayName("kaleid", "修复登录"), "kaleid - 修复登录");
  assert.deepEqual(normalizeSessionLabels([" bug ", "#urgent", "bug", "", null]), ["bug", "urgent"]);
  assert.equal(formatSessionDisplayName("kaleid", "修复登录", ["bug", "urgent"]), "kaleid - 修复登录 #bug #urgent");
  assert.equal(
    formatSessionDisplayName("kaleid", "修复登录", ["bug", "urgent", "qa"], { maxLabels: 2 }),
    "kaleid - 修复登录 #bug #urgent +1"
  );
  assert.equal(truncateConversationLabel("kaleid - 修复登录", 12), "kaleid - 修…");
  assert.equal(truncateConversationLabel("abcdef", 2), "a…");
  assert.equal(getMultilineInputRows("one\ntwo", 80), 2);
  assert.equal(getMultilineInputRows("x\nx\nx\nx\nx\nx\nx", 80), 6);
  assert.equal(getMultilineInputRows("xxxx", 4), 2);
  assert.equal(getMultilineInputRows("xxxx\nok", 4), 3);
  assert.equal(getMultilineInputRows("xxxx\nok", 4, { cursor: 7 }), 2);
  assert.equal(MULTILINE_INPUT_NEWLINE_HINT, "Enter send · Ctrl+J newline");
  assert.equal(shouldInsertInputNewline("j", { ctrl: true }), true);
  assert.equal(shouldInsertInputNewline("", { meta: true, return: true }), true);
  assert.equal(shouldInsertInputNewline("\n", {}), true);
  assert.equal(shouldInsertInputNewline("\u001b\r", {}), true);
  assert.equal(shouldInsertInputNewline("", { return: true }), false);
  assert.equal(shouldInsertInputNewline("\r", { return: true }), false);
  assert.equal(normalizeInputText("a\rb"), "a\nb");
});

test("OAuth helpers decode account ids and refresh via mocked token endpoint", async () => {
  assert.equal(decodeAccountId(fakeJwt("acct_1")), "acct_1");

  let sawRefreshGrant = false;
  const creds = await refresh("refresh_1", {
    fetchImpl: async (_url, init) => {
      const body = init?.body as URLSearchParams;
      sawRefreshGrant = body.get("grant_type") === "refresh_token" && body.get("refresh_token") === "refresh_1";
      return new Response(
        JSON.stringify({ access_token: fakeJwt("acct_2"), refresh_token: "refresh_2", expires_in: 3600 }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
  });

  assert.equal(sawRefreshGrant, true);
  assert.equal(creds.accountId, "acct_2");
  assert.equal(creds.refresh, "refresh_2");
});

test("OAuth login prints the authorization URL and accepts manual code when the opener fails", async () => {
  const stdin = new PassThrough() as unknown as NodeJS.ReadStream;
  Object.defineProperty(stdin, "isTTY", { value: true });
  stdin.end("manual_code\n");

  const stdoutChunks: string[] = [];
  const stdout = new Writable({
    write(chunk, _encoding, callback) {
      stdoutChunks.push(String(chunk));
      callback();
    }
  }) as NodeJS.WriteStream;

  let sawManualCode = false;
  const creds = await login({
    openBrowser: () => false,
    stdin,
    stdout,
    fetchImpl: async (_url, init) => {
      const body = init?.body as URLSearchParams;
      sawManualCode = body.get("grant_type") === "authorization_code" && body.get("code") === "manual_code";
      return new Response(
        JSON.stringify({ access_token: fakeJwt("acct_manual"), refresh_token: "refresh_manual", expires_in: 3600 }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
  });

  const stdoutText = stdoutChunks.join("");
  assert.match(stdoutText, /Open this URL to authenticate:/u);
  assert.match(stdoutText, /Paste OAuth code or callback URL:/u);
  assert.equal(sawManualCode, true);
  assert.equal(creds.accountId, "acct_manual");
});

test("OAuth login callbacks expose the URL, accept manual callback URLs, and do not write stdout", async () => {
  let openedUrl = "";
  let authUrl = "";
  const statuses: string[] = [];
  let sawManualCode = false;
  const stdout = {
    write() {
      throw new Error("stdout should not be used when onAuthUrl is provided");
    }
  } as unknown as Pick<NodeJS.WriteStream, "write">;

  const creds = await login({
    openBrowser: (url) => {
      openedUrl = url;
      return false;
    },
    stdout,
    onAuthUrl: (url) => {
      authUrl = url;
    },
    onStatus: (message) => {
      statuses.push(message);
    },
    getManualCode: async () => {
      const state = new URL(authUrl).searchParams.get("state");
      return `http://localhost:1455/auth/callback?code=manual_code&state=${state}`;
    },
    fetchImpl: async (_url, init) => {
      const body = init?.body as URLSearchParams;
      sawManualCode = body.get("grant_type") === "authorization_code" && body.get("code") === "manual_code";
      return new Response(
        JSON.stringify({ access_token: fakeJwt("acct_callback"), refresh_token: "refresh_callback", expires_in: 3600 }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
  });

  assert.equal(openedUrl, authUrl);
  assert.match(authUrl, /^https:\/\/auth\.openai\.com\/oauth\/authorize/u);
  assert.match(statuses.join("\n"), /等待手动粘贴/u);
  assert.match(statuses.join("\n"), /正在换取令牌/u);
  assert.equal(sawManualCode, true);
  assert.equal(creds.accountId, "acct_callback");
});

test("OAuth login callback flow surfaces token exchange failures", async () => {
  await assert.rejects(
    login({
      openBrowser: () => true,
      onAuthUrl: () => undefined,
      getManualCode: async () => "manual_code",
      fetchImpl: async () => new Response("bad token", { status: 500, statusText: "Internal Server Error" })
    }),
    /OAuth token request failed \(500\): bad token/u
  );
});

test("system opener reports failure instead of throwing when the opener binary is missing", async () => {
  const oldPath = process.env.PATH;
  const emptyPath = await mkdtemp(join(tmpdir(), "kaleid-empty-path-"));
  process.env.PATH = emptyPath;
  try {
    assert.equal(await systemOpenBrowser("https://example.com/"), false);
  } finally {
    if (oldPath === undefined) {
      delete process.env.PATH;
    } else {
      process.env.PATH = oldPath;
    }
    await rm(emptyPath, { recursive: true, force: true });
  }
});

test("token store saves 0600 credentials and refreshes expired credentials with a mock", async () => {
  await withTempAuthFile(async (file) => {
    const expired: Creds = {
      access: fakeJwt("old"),
      refresh: "refresh_old",
      expires: Date.now() - 1000,
      accountId: "old"
    };
    await save(expired);
    assert.deepEqual(await load(), expired);
    assert.equal((await stat(file)).mode & 0o777, 0o600);

    const fresh = await ensureValid({
      fetchImpl: async () =>
        new Response(
          JSON.stringify({ access_token: fakeJwt("new"), refresh_token: "refresh_new", expires_in: 3600 }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
    });

    assert.equal(fresh.accountId, "new");
    assert.equal((await load())?.refresh, "refresh_new");
  });
});

test("config store saves provider API keys with env override and 0600 permissions", async () => {
  await withTempConfigFile(async (file) => {
    await saveApiKey("deepseek", "sk-deepseek");
    assert.deepEqual(await loadConfig(), { deepseek: { apiKey: "sk-deepseek" } });
    assert.equal(await getApiKey("deepseek"), "sk-deepseek");
    assert.equal((await stat(file)).mode & 0o777, 0o600);

    process.env.DEEPSEEK_API_KEY = "sk-env";
    assert.equal(await getApiKey("deepseek"), "sk-env");
    delete process.env.DEEPSEEK_API_KEY;

    await saveApiKey("kimi", "sk-kimi");
    assert.equal(await getApiKey("kimi"), "sk-kimi");

    await clearApiKeys("deepseek");
    assert.equal(await getApiKey("deepseek"), null);
    assert.equal(await getApiKey("kimi"), "sk-kimi");

    await clearApiKeys();
    assert.deepEqual(await loadConfig(), {});
  });
});

test("authenticated model registry filters providers and falls back for DeepSeek models", async () => {
  await withTempAuthFile(async () => {
    await withTempConfigFile(async () => {
      await save({
        access: fakeJwt("acct_models"),
        refresh: "refresh_models",
        expires: Date.now() + 1000,
        accountId: "acct_models"
      });
      await saveApiKey("deepseek", "sk-deepseek");
      await saveApiKey("kimi", "sk-kimi");

      const dynamicModels = await getAuthenticatedModels({
        fetchImpl: async (url, init) => {
          assert.equal(url, `${DEEPSEEK_BASE_URL}/models`);
          assert.equal((init?.headers as Record<string, string>).Authorization, "Bearer sk-deepseek");
          return new Response(
            JSON.stringify({ data: [{ id: "deepseek-v4-pro" }, { id: "deepseek-reasoner" }] }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
      });

      assert.ok(dynamicModels.some((model) => model.id === "gpt-5.5" && model.provider === "openai-codex"));
      assert.ok(dynamicModels.some((model) => model.id === "deepseek-reasoner" && model.provider === "deepseek"));
      assert.ok(dynamicModels.some((model) => model.id === "kimi-for-coding" && model.provider === "kimi"));
      assert.equal((await createProviderForModel("deepseek-reasoner", dynamicModels)).id, "deepseek");

      const fallbackModels = await getAuthenticatedModels({
        fetchImpl: async () => new Response("bad", { status: 500, statusText: "Internal Server Error" })
      });
      assert.deepEqual(
        fallbackModels.filter((model) => model.provider === "deepseek").map((model) => model.id),
        DEEPSEEK_FALLBACK_MODELS.map((model) => model.id)
      );
      assert.deepEqual(
        fallbackModels.filter((model) => model.provider === "kimi"),
        KIMI_MODELS
      );
    });
  });
});

test("DeepSeek model fetch validates OpenAI-compatible /models responses", async () => {
  const models = await fetchDeepSeekModels("sk-deepseek", async (_url, _init) =>
    new Response(JSON.stringify({ data: [{ id: "deepseek-v4-flash" }] }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    })
  );

  assert.deepEqual(models, [{ id: "deepseek-v4-flash", provider: "deepseek", label: "[deepseek]" }]);

  await assert.rejects(
    fetchDeepSeekModels("sk-deepseek", async () => new Response(JSON.stringify({ data: [] }), { status: 200 })),
    /did not include models/u
  );
});

test("Responses encoder preserves messages, tool calls, tool outputs, and tool schemas", () => {
  const body = buildRequestBody({
    model: "gpt-5.5",
    systemPrompt: "system",
    sessionId: "session_1",
    messages: [
      { role: "system", content: "runtime system summary" },
      { role: "user", content: "read it" },
      { role: "assistant", content: "", toolCalls: [{ id: "call_1", name: "read", arguments: { path: "a.txt" } }] },
      { role: "tool", content: "1\tok", toolCallId: "call_1" }
    ],
    tools: [{ name: "read", description: "Read", parameters: { type: "object" } }],
    reasoningEffort: "high"
  });

  assert.equal(body.prompt_cache_key, "session_1");
  assert.equal(body.reasoning.effort, "high");
  assert.equal(body.instructions, "system");
  assert.equal((body.input as Array<Record<string, unknown>>).some((item) => item.role === "system"), false);
  assert.equal(body.input[0]?.type, "message");
  assert.equal(body.input[1]?.type, "function_call");
  assert.equal(body.input[2]?.type, "function_call_output");
  assert.equal(body.tools[0]?.type, "function");
});

test("Responses encoder defaults reasoning effort to medium", () => {
  const body = buildRequestBody({
    model: "gpt-5.5",
    systemPrompt: "system",
    messages: [],
    tools: []
  });

  assert.equal(body.reasoning.effort, "medium");
});

test("Responses SSE parser yields text, tool calls, and tool-call finish reason from fixtures", async () => {
  const fixture = [
    `data: ${JSON.stringify({ type: "response.output_text.delta", delta: "Need file." })}`,
    "",
    `data: ${JSON.stringify({
      type: "response.output_item.added",
      item: { type: "function_call", call_id: "call_1", name: "read", arguments: "" }
    })}`,
    "",
    `data: ${JSON.stringify({
      type: "response.function_call_arguments.delta",
      call_id: "call_1",
      delta: "{\"path\":\"package.json\"}"
    })}`,
    "",
    `data: ${JSON.stringify({
      type: "response.output_item.done",
      item: { type: "function_call", call_id: "call_1", name: "read", arguments: "{\"path\":\"package.json\"}" }
    })}`,
    "",
    `data: ${JSON.stringify({ type: "response.completed", response: { finish_reason: "stop" } })}`,
    "",
    "data: [DONE]",
    "",
    ""
  ].join("\n");

  const events = await collect(parseResponsesSSE(streamFromString(fixture)));
  assert.deepEqual(events[0], { type: "text", delta: "Need file." });
  assert.deepEqual(events[1], {
    type: "tool_call",
    toolCall: { id: "call_1", name: "read", arguments: { path: "package.json" } }
  });
  assert.deepEqual(events[2], { type: "done", finishReason: "tool_calls" });
});

test("OpenAI-compatible encoder and SSE parser handle chat tools", async () => {
  const body = buildChatCompletionBody({
    model: "deepseek-v4-pro",
    systemPrompt: "system",
    messages: [
      { role: "user", content: "read it" },
      { role: "assistant", content: "", toolCalls: [{ id: "call_1", name: "read", arguments: { path: "a.txt" } }] },
      { role: "tool", toolCallId: "call_1", content: "ok" }
    ],
    tools: [{ name: "read", description: "Read", parameters: { type: "object" } }]
  });

  const messages = body.messages as Array<Record<string, unknown>>;
  const tools = body.tools as Array<{ function: Record<string, unknown> }>;
  assert.deepEqual(messages[0], { role: "system", content: "system" });
  assert.equal((messages[2]?.tool_calls as Array<Record<string, unknown>>)[0]?.type, "function");
  assert.deepEqual(messages[3], { role: "tool", tool_call_id: "call_1", content: "ok" });
  assert.equal(tools[0]?.function.name, "read");

  const fixture = [
    `data: ${JSON.stringify({ choices: [{ delta: { content: "Need file." } }] })}`,
    "",
    `data: ${JSON.stringify({
      choices: [
        {
          delta: {
            tool_calls: [
              { index: 0, id: "call_2", function: { name: "read", arguments: "{\"path\"" } }
            ]
          }
        }
      ]
    })}`,
    "",
    `data: ${JSON.stringify({
      choices: [
        {
          delta: {
            tool_calls: [{ index: 0, function: { arguments: ":\"package.json\"}" } }]
          },
          finish_reason: "tool_calls"
        }
      ]
    })}`,
    "",
    "data: [DONE]",
    "",
    ""
  ].join("\n");

  const events = await collect(parseChatCompletionsSSE(streamFromString(fixture)));
  assert.deepEqual(events[0], { type: "text", delta: "Need file." });
  assert.deepEqual(events[1], {
    type: "tool_call",
    toolCall: { id: "call_2", name: "read", arguments: { path: "package.json" } }
  });
  assert.deepEqual(events[2], { type: "done", finishReason: "tool_calls" });
});

test("OpenAI-compatible provider preserves DeepSeek reasoning content without displaying it", async () => {
  const body = buildChatCompletionBody({
    model: "deepseek-reasoner",
    systemPrompt: "system",
    messages: [
      { role: "user", content: "continue" },
      { role: "assistant", content: "visible", reasoningContent: "hidden reasoning" },
      { role: "assistant", content: "plain" }
    ],
    tools: []
  });

  const messages = body.messages as Array<Record<string, unknown>>;
  assert.equal(messages[1]?.role, "user");
  assert.equal(messages[1]?.reasoning_content, undefined);
  assert.equal(messages[2]?.reasoning_content, "hidden reasoning");
  assert.equal(messages[3]?.reasoning_content, "");

  const fixture = [
    `data: ${JSON.stringify({ choices: [{ delta: { reasoning_content: "think " } }] })}`,
    "",
    `data: ${JSON.stringify({ choices: [{ delta: { reasoning: "more ", content: "visible" } }] })}`,
    "",
    `data: ${JSON.stringify({ choices: [{ delta: { reasoning_text: "done" }, finish_reason: "stop" }] })}`,
    "",
    "data: [DONE]",
    "",
    ""
  ].join("\n");

  const events = await collect(parseChatCompletionsSSE(streamFromString(fixture)));
  assert.deepEqual(
    events.filter((event) => event.type === "reasoning").map((event) => event.delta),
    ["think ", "more ", "done"]
  );
  assert.deepEqual(
    events.filter((event) => event.type === "text"),
    [{ type: "text", delta: "visible" }]
  );
  assert.deepEqual(events.at(-1), { type: "done", finishReason: "stop" });
});

test("runTurn stores fake DeepSeek reasoning and sends it back after a tool call", async () => {
  await withTempSessions(async () => {
    const dir = await mkdtemp(join(tmpdir(), "kaleid-deepseek-"));
    try {
      await writeFile(join(dir, "input.txt"), "file contents", "utf8");
      const requestBodies: Array<Record<string, unknown>> = [];
      const provider = new OpenAICompatProvider({
        id: "deepseek",
        baseURL: "https://deepseek.fake/v1",
        apiKey: "sk-test",
        defaultModel: "deepseek-reasoner",
        fetchImpl: async (_url, init) => {
          requestBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
          if (requestBodies.length === 1) {
            return new Response(
              streamFromString(
                [
                  `data: ${JSON.stringify({ choices: [{ delta: { reasoning_content: "I should inspect the file.", content: "Reading." } }] })}`,
                  "",
                  `data: ${JSON.stringify({
                    choices: [
                      {
                        delta: {
                          tool_calls: [
                            {
                              index: 0,
                              id: "call_1",
                              function: { name: "read", arguments: "{\"path\":\"input.txt\"}" }
                            }
                          ]
                        },
                        finish_reason: "tool_calls"
                      }
                    ]
                  })}`,
                  "",
                  "data: [DONE]",
                  "",
                  ""
                ].join("\n")
              ),
              { status: 200, headers: { "Content-Type": "text/event-stream" } }
            );
          }

          return new Response(
            streamFromString(
              `data: ${JSON.stringify({ choices: [{ delta: { content: "done" }, finish_reason: "stop" }] })}\n\n`
            ),
            { status: 200, headers: { "Content-Type": "text/event-stream" } }
          );
        }
      });

      const session = createSession();
      const events = await collect(
        runTurn(session, "read input.txt", {
          provider,
          tools: [readTool],
          model: "deepseek-reasoner",
          cwd: dir
        })
      );

      assert.deepEqual(
        events.filter((event) => event.type === "assistant_text").map((event) => event.delta),
        ["Reading.", "done"]
      );
      const firstAssistant = session.messages.find((message) => message.role === "assistant");
      assert.equal(firstAssistant?.reasoningContent, "I should inspect the file.");

      const secondMessages = requestBodies[1]?.messages as Array<Record<string, unknown>>;
      const replayedAssistant = secondMessages.find((message) => message.role === "assistant");
      assert.equal(replayedAssistant?.reasoning_content, "I should inspect the file.");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

test("OpenAICompatProvider posts bearer-authenticated streaming chat completions", async () => {
  const provider = new OpenAICompatProvider({
    id: "deepseek",
    baseURL: "https://compat.example/v1/",
    apiKey: "sk-test",
    defaultModel: "deepseek-v4-pro",
    fetchImpl: async (url, init) => {
      assert.equal(url, "https://compat.example/v1/chat/completions");
      assert.equal((init?.headers as Record<string, string>).Authorization, "Bearer sk-test");
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      assert.equal(body.model, "deepseek-v4-pro");
      assert.equal(body.stream, true);
      return new Response(
        streamFromString(
          `data: ${JSON.stringify({ choices: [{ delta: { content: "ok" }, finish_reason: "stop" }] })}\n\n`
        ),
        { status: 200, headers: { "Content-Type": "text/event-stream" } }
      );
    }
  });

  const events = await collect(
    provider.chat({ messages: [], tools: [], model: "deepseek-v4-pro", systemPrompt: "system" })
  );
  assert.deepEqual(events, [
    { type: "text", delta: "ok" },
    { type: "done", finishReason: "stop" }
  ]);
});

test("OpenAICodexProvider retries one 401 with mocked token refresh and fake SSE", async () => {
  const authHeaders: string[] = [];
  const provider = new OpenAICodexProvider({
    tokenStore: {
      ensureValid: async () => ({
        access: "old_access",
        refresh: "refresh",
        expires: Date.now() + 100000,
        accountId: "acct"
      }),
      forceRefresh: async () => ({
        access: "new_access",
        refresh: "refresh",
        expires: Date.now() + 100000,
        accountId: "acct"
      })
    },
    fetchImpl: async (_url, init) => {
      const headers = init?.headers as Record<string, string>;
      authHeaders.push(headers.Authorization ?? "");
      if (authHeaders.length === 1) {
        return new Response("unauthorized", { status: 401 });
      }
      return new Response(
        streamFromString(`data: ${JSON.stringify({ type: "response.output_text.delta", delta: "ok" })}\n\ndata: ${JSON.stringify({ type: "response.completed" })}\n\n`),
        { status: 200, headers: { "Content-Type": "text/event-stream" } }
      );
    }
  });

  const events = await collect(
    provider.chat({ messages: [], tools: [], model: "gpt-5.5", systemPrompt: "system" })
  );
  assert.deepEqual(authHeaders, ["Bearer old_access", "Bearer new_access"]);
  assert.deepEqual(events[0], { type: "text", delta: "ok" });
});

test("tools read/write/edit files in temp dirs and bash returns exit code", async () => {
  const dir = await mkdtemp(join(tmpdir(), "kaleid-tools-"));
  try {
    const writeResult = await writeTool.execute({ path: "nested/a.txt", content: "one\ntwo\nthree" }, { cwd: dir });
    assert.equal(writeResult.isError, undefined);
    assert.equal(await readFile(join(dir, "nested/a.txt"), "utf8"), "one\ntwo\nthree");

    const manyLines = Array.from({ length: 3000 }, (_unused, index) => `line${index + 1}`).join("\n");
    await writeFile(join(dir, "many.txt"), manyLines, "utf8");
    const readMany = await readTool.execute({ path: "many.txt" }, { cwd: dir });
    assert.match(readMany.output, /2000\tline2000/u);
    assert.match(readMany.output, /truncated/u);

    const readSlice = await readTool.execute({ path: "many.txt", offset: 100, limit: 20 }, { cwd: dir });
    assert.match(readSlice.output, /100\tline100/u);
    assert.doesNotMatch(readSlice.output, /120\tline120/u);

    await writeFile(join(dir, "dup.txt"), "x\nx\n", "utf8");
    const duplicate = await editTool.execute({ path: "dup.txt", old_string: "x", new_string: "y" }, { cwd: dir });
    assert.equal(duplicate.isError, true);
    assert.equal(await readFile(join(dir, "dup.txt"), "utf8"), "x\nx\n");

    const edited = await editTool.execute({ path: "nested/a.txt", old_string: "two", new_string: "TWO" }, { cwd: dir });
    assert.equal(edited.isError, undefined);
    assert.equal(await readFile(join(dir, "nested/a.txt"), "utf8"), "one\nTWO\nthree");

    const bash = await bashTool.execute({ command: "echo hi && exit 3" }, { cwd: dir });
    assert.match(bash.output, /hi/u);
    assert.match(bash.output, /\[exit code: 3\]/u);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("executeBash cancels timed-out process and truncates large output", async () => {
  const dir = await mkdtemp(join(tmpdir(), "kaleid-bash-"));
  try {
    const timeout = await executeBash("sleep 2", { cwd: dir, timeoutSec: 0.1 });
    assert.equal(timeout.cancelled, true);

    const large = await executeBash("node -e \"process.stdout.write('a'.repeat(110000))\"", { cwd: dir });
    assert.equal(large.truncated, true);
    assert.match(large.output, /output truncated/u);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("runTurn executes requested tools, feeds results back, and finishes", async () => {
  await withTempSessions(async () => {
    const dir = await mkdtemp(join(tmpdir(), "kaleid-loop-"));
    try {
      let calls = 0;
      const seenRequests: Array<Pick<ChatParams, "model" | "reasoningEffort">> = [];
      const provider: LLMProvider = {
        id: "fake",
        async *chat(params: ChatParams): AsyncIterable<StreamEvent> {
          seenRequests.push({ model: params.model, reasoningEffort: params.reasoningEffort });
          calls += 1;
          if (calls === 1) {
            yield {
              type: "tool_call",
              toolCall: { id: "call_1", name: "write", arguments: { path: "out.txt", content: "ok" } }
            };
            yield { type: "done", finishReason: "tool_calls" };
            return;
          }
          yield { type: "text", delta: "done" };
          yield { type: "usage", usage: { inputTokens: 40, outputTokens: 5, totalTokens: 45 } };
          yield { type: "done", finishReason: "stop" };
        }
      };

      const session = createSession();
      const events = await collect(
        runTurn(session, "create a file", {
          provider,
          tools: [writeTool],
          model: "fake-model",
          reasoningEffort: "high",
          cwd: dir
        })
      );

      assert.equal(await readFile(join(dir, "out.txt"), "utf8"), "ok");
      assert.deepEqual(seenRequests, [
        { model: "fake-model", reasoningEffort: "high" },
        { model: "fake-model", reasoningEffort: "high" }
      ]);
      assert.deepEqual(
        events.map((event) => event.type),
        ["token_update", "token_update", "tool_start", "tool_end", "token_update", "token_update", "assistant_text", "token_update", "turn_done"]
      );
      assert.deepEqual(session.messages.map((message) => message.role), ["user", "assistant", "tool", "assistant"]);
      assert.equal(session.getTokenState("fake-model").source, "provider");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

test("session persistence writes jsonl and resume rebuilds compacted messages", async () => {
  await withTempSessions(async (dir) => {
    const session = createSession({ id: "session_test", model: "gpt-5.5" });
    session.setRunState("gpt-5.5", "high");
    session.append({ role: "user", content: "first task" });
    session.append({ role: "assistant", content: "first answer" });
    await session.persist();

    const summaries = await listSessions();
    assert.equal(summaries[0]?.id, "session_test");
    assert.equal(summaries[0]?.title, "first task");
    assert.equal(summaries[0]?.project, null);
    assert.equal(summaries[0]?.name, "first task");
    assert.equal(summaries[0]?.label, "first task");

    const restored = await loadSessionData("session_test");
    assert.equal(restored.metadata.model, "gpt-5.5");
    assert.equal(restored.metadata.reasoningEffort, "high");
    assert.equal(restored.metadata.project, null);
    assert.equal(restored.metadata.name, "first task");
    assert.deepEqual(restored.metadata.labels, []);
    assert.deepEqual(restored.messages.map((message) => message.content), ["first task", "first answer"]);

    const renamed = createSession({ id: "session_test", messages: restored.messages, metadata: restored.metadata, persisted: true });
    renamed.renameConversation("修复登录", "kaleid");
    assert.equal(renamed.addLabel("bug"), true);
    assert.equal(renamed.addLabel("#urgent"), true);
    assert.equal(renamed.addLabel("bug"), false);
    await renamed.persist();

    const renamedData = await loadSessionData("session_test");
    assert.equal(renamedData.metadata.project, "kaleid");
    assert.equal(renamedData.metadata.name, "修复登录");
    assert.deepEqual(renamedData.metadata.labels, ["bug", "urgent"]);
    const entries = (await readFile(join(dir, "session_test.jsonl"), "utf8"))
      .trim()
      .split(/\r?\n/u)
      .map((line) => JSON.parse(line) as { type: string; metadata?: { project?: string | null; name?: string; labels?: string[] } });
    const lastMeta = entries.filter((entry) => entry.type === "meta").at(-1);
    assert.equal(lastMeta?.metadata?.project, "kaleid");
    assert.equal(lastMeta?.metadata?.name, "修复登录");
    assert.deepEqual(lastMeta?.metadata?.labels, ["bug", "urgent"]);
    const renamedSummaries = await listSessions();
    assert.equal(renamedSummaries[0]?.label, "kaleid - 修复登录 #bug #urgent");
    const second = createSession({ id: "session_second", model: "gpt-5.5" });
    second.renameConversation("参考实现", "pi");
    assert.equal(second.addLabel("bug"), true);
    await second.persist();
    const metadataOptions = await listSessionMetadataOptions();
    assert.deepEqual(metadataOptions, { projects: ["kaleid", "pi"], labels: ["bug", "urgent"] });

    const labeled = createSession({ id: "session_test", messages: renamedData.messages, metadata: renamedData.metadata, persisted: true });
    assert.equal(labeled.removeLabel("bug"), true);
    assert.equal(labeled.removeLabel("missing"), false);
    await labeled.persist();

    const labeledData = await loadSessionData("session_test");
    assert.deepEqual(labeledData.metadata.labels, ["urgent"]);

    const compacted = createSession({ id: "session_test", messages: labeledData.messages, metadata: labeledData.metadata, persisted: true });
    const provider: LLMProvider = {
      id: "fake",
      async *chat(): AsyncIterable<StreamEvent> {
        yield { type: "text", delta: "summary" };
      }
    };
    compacted.append({ role: "user", content: "second task" });
    const result = await compacted.maybeCompact({
      provider,
      model: "gpt-5.5",
      systemPrompt: "system",
      force: true
    });
    assert.equal(result.compacted, true);
    await compacted.persist();

    const resumed = await loadSessionData("session_test");
    assert.equal(resumed.messages[0]?.role, "user");
    assert.match(resumed.messages[0]?.content ?? "", new RegExp(COMPACTION_SUMMARY_PREFIX, "u"));
    assert.equal(resumed.messages.at(-1)?.content, "second task");
  });
});
