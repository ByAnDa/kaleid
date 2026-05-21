import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { parseArgs } from "../src/cli/args.js";
import { decodeAccountId, refresh } from "../src/auth/oauth.js";
import { ensureValid, load, save, type Creds } from "../src/auth/token-store.js";
import { buildRequestBody } from "../src/provider/responses-encode.js";
import { parseResponsesSSE } from "../src/provider/responses-sse.js";
import { OpenAICodexProvider } from "../src/provider/openai-codex.js";
import type { ChatParams, LLMProvider, StreamEvent } from "../src/provider/types.js";
import { runTurn } from "../src/loop/agent-loop.js";
import { createSession } from "../src/loop/session.js";
import { bashTool } from "../src/tools/bash.js";
import { executeBash } from "../src/tools/bash-executor.js";
import { editTool } from "../src/tools/edit.js";
import { readTool } from "../src/tools/read.js";
import { writeTool } from "../src/tools/write.js";

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
  assert.deepEqual(parseArgs(["login"]), {
    command: "login",
    model: "gpt-5.5",
    help: false,
    version: false
  });
  assert.equal(parseArgs(["--model", "gpt-x", "-p", "hello"]).model, "gpt-x");
  assert.deepEqual(parseArgs(["fix", "tests"]).command, "oneshot");
  assert.equal(parseArgs([]).command, "repl");
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
    tools: [{ name: "read", description: "Read", parameters: { type: "object" } }]
  });

  assert.equal(body.prompt_cache_key, "session_1");
  assert.equal(body.input[0]?.type, "message");
  assert.equal(body.input[1]?.type, "function_call");
  assert.equal(body.input[2]?.type, "function_call_output");
  assert.equal(body.tools[0]?.type, "function");
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
    const provider: LLMProvider = {
      id: "fake",
      async *chat(_params: ChatParams): AsyncIterable<StreamEvent> {
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
      runTurn(session, "create a file", { provider, tools: [writeTool], model: "fake-model", cwd: dir })
    );

    assert.equal(await readFile(join(dir, "out.txt"), "utf8"), "ok");
    assert.deepEqual(events.map((event) => event.type), ["tool_start", "tool_end", "assistant_text", "turn_done"]);
    assert.deepEqual(session.messages.map((message) => message.role), ["user", "assistant", "tool", "assistant"]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
