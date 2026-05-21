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
import { bashTool } from "../src/tools/bash.js";
import { executeBash } from "../src/tools/bash-executor.js";
import { editTool } from "../src/tools/edit.js";
import { readTool } from "../src/tools/read.js";
import { writeTool } from "../src/tools/write.js";
import { getSlashCommandCompletions, parseSlash, runSlashCommand } from "../src/tui/commands.js";
import { applySelectorTransition, cancelSelectorTransition } from "../src/tui/app.js";
import {
  buildConversationEntries,
  getVisibleConversationEntries
} from "../src/tui/components/Conversation.js";
import { formatHeaderState, truncateHeaderState } from "../src/tui/components/Header.js";
import { getInputBarHeight } from "../src/tui/components/InputBar.js";
import { getMessageStyle } from "../src/tui/components/Message.js";
import { formatOptionSelectorLine, getOptionSelectorHeight } from "../src/tui/components/OptionSelector.js";
import { formatToolCallLine } from "../src/tui/components/ToolCall.js";
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
    "/exit",
    "/help"
  ]);
  assert.deepEqual(getSlashCommandCompletions("/lo")?.map((command) => command.command), ["/login", "/logout"]);
  assert.deepEqual(getSlashCommandCompletions("/mo")?.map((command) => command.command), ["/model"]);
  assert.deepEqual(getSlashCommandCompletions("/nope"), []);
  assert.equal(getSlashCommandCompletions("plain /"), null);
  assert.equal(getSlashCommandCompletions("/login now"), null);

  const help = await runSlashCommand({ command: "/help", args: [] });
  assert.equal(help.action, "continue");
  assert.match(help.messages[0] ?? "", /\/login/u);
  assert.match(help.messages[0] ?? "", /\/logout/u);
  assert.match(help.messages[0] ?? "", /\/model/u);
  assert.match(help.messages[0] ?? "", /\/reasoning/u);
  assert.match(help.messages[0] ?? "", /\/exit/u);
  assert.match(help.messages[0] ?? "", /\/help/u);

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

  const visible = getVisibleConversationEntries(buildConversationEntries(messages, null), 3, 40);
  assert.deepEqual(visible.map((entry) => entry.id), ["m4", "m5", "m6"]);

  const withStreaming = getVisibleConversationEntries(buildConversationEntries(messages, "streaming answer"), 2, 40);
  assert.deepEqual(withStreaming.map((entry) => entry.id), ["m6", "streaming"]);

  const trimmed = getVisibleConversationEntries(buildConversationEntries([], "line 1\nline 2\nline 3"), 2, 40);
  assert.equal(trimmed[0]?.kind, "streaming");
  assert.equal(trimmed[0]?.kind === "streaming" ? trimmed[0].text : "", "line 2\nline 3");
});

test("TUI message labels and tool calls use distinct visual roles", () => {
  assert.deepEqual(getMessageStyle("user"), { label: "you ›", color: "green", bold: true });
  assert.deepEqual(getMessageStyle("assistant"), { label: "kaleid ›", color: "cyan" });
  assert.deepEqual(getMessageStyle("system"), { label: "system ›", color: "gray", dimColor: true });

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
});

test("TUI header and option selector format model and reasoning state", () => {
  assert.equal(formatHeaderState("gpt-5.5", "high"), "gpt-5.5 · high");
  assert.equal(formatHeaderState("kimi-for-coding", null, "kimi"), "kimi-for-coding [kimi] · -");
  assert.equal(truncateHeaderState("gpt-5.5-pro · medium", 12), "gpt-5.5-p...");
  assert.equal(getOptionSelectorHeight(5), 8);
  assert.equal(
    formatOptionSelectorLine({ id: "gpt-5.5", current: true }, true),
    "> * gpt-5.5 (current)"
  );
  assert.equal(formatOptionSelectorLine({ id: "high", current: false }, false), "    high");
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
    3
  );
  assert.equal(
    getInputBarHeight({ manualCodePrompt: null, slashCommandCount: 4, slashMenuVisible: true, status: null }),
    7
  );
  assert.equal(
    getInputBarHeight({
      manualCodePrompt: "粘贴 OAuth code 或回调 URL，回车提交",
      slashCommandCount: 0,
      slashMenuVisible: true,
      status: "waiting"
    }),
    6
  );
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
      { role: "user", content: "read it" },
      { role: "assistant", content: "", toolCalls: [{ id: "call_1", name: "read", arguments: { path: "a.txt" } }] },
      { role: "tool", content: "1\tok", toolCallId: "call_1" }
    ],
    tools: [{ name: "read", description: "Read", parameters: { type: "object" } }],
    reasoningEffort: "high"
  });

  assert.equal(body.prompt_cache_key, "session_1");
  assert.equal(body.reasoning.effort, "high");
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
    assert.deepEqual(events.map((event) => event.type), ["tool_start", "tool_end", "assistant_text", "turn_done"]);
    assert.deepEqual(session.messages.map((message) => message.role), ["user", "assistant", "tool", "assistant"]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
