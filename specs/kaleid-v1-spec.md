---
项目: kaleid（ByAnDa 自用 Harness Agent / 终端编码 agent）
文档: kaleid V1 技术 spec（Stage 4，对应 PRD v0.3）— **详细版 v2**
作者: kaleidLead
生成时间: 2026-05-22（v2 详细化：抠出 pi 源码 wire 细节，把"待核对"换成实打实契约）
Reviewer: ByAnDa
上游: 《工程开发总流程 v1》stage 4 / 《跨项目 Spec 工作流规则 v1.5》/ PRD = `kaleid PRD v0.3.md`
状态: **待 ByAnDa Gate 1 审核**
编号格式（L2 自决）: `spec-<NNN>`
参考实现（仅借鉴模式/公开常量，clean-room 自写）: pi `pi-ai/utils/oauth/openai-codex.ts`、`pi-ai/utils/oauth/pkce.ts`、`pi-ai/providers/openai-codex-responses.ts`、`pi-coding-agent/core/tools/{read,edit,write,bash,truncate}.ts`、`core/system-prompt.ts`
---

# kaleid V1 spec（详细版）— 最小 Harness 内核

> 路线 **(a) clean-room 自写**：下文 wire 细节（端点/header/常量/请求体）均**抠自 pi 现网实现**，作为照搬的"值"（公开常量与协议），代码 kaleid 自写。
> 项目 = CLI/工具，仅终端 TUI、无 web UI → 按 L1 §3.1.4 例外**无需设计稿**。

## 模块枚举（L2）
`scaffold` / `auth` / `provider` / `tools` / `loop` / `tui` / `cli`

## Spec 索引
| 编号 | 功能 | 状态 | 模块 | 依赖 |
|---|---|---|---|---|
| spec-001 | 项目骨架 + npm 打包 + 构建 | ⬜ | scaffold | 无 |
| spec-002 | OAuth（OpenAI Codex / ChatGPT 登录）+ 凭证存储 | ⬜ | auth | spec-001 |
| spec-003 | LLMProvider 接口 + OpenAICodexProvider（Responses API）| ⬜ | provider | spec-001, spec-002 |
| spec-004 | Tool 接口 + 4 工具 + bash chokepoint | ⬜ | tools | spec-001 |
| spec-005 | Agent Loop + 消息层（预留 compaction/persist）| ⬜ | loop | spec-003, spec-004 |
| spec-006 | CLI 入口 + 交互模式（login/repl/one-shot）| ⬜ | cli | spec-005 |
| spec-007 | 简单 TUI（ink，防闪）| ⬜ | tui | spec-005, spec-006 |

> ⬜ 待实现 / 🔨 进行中 / ✅ 已完成
> （v2 把原 spec-002 拆成 002 auth + 003 provider，更便于 Multica 并行 + 单测。）

## 目标文件结构
```
kaleid/
  package.json          type:module, bin:{kaleid:"dist/index.js"}, engines.node>=22
  tsconfig.json         jsx:react-jsx, module:ESNext, moduleResolution:bundler, target:ES2022, strict
  esbuild.config.mjs    bundle src/index.ts → dist/index.js, platform=node, banner shebang
  README.md
  src/
    index.ts            入口：parseArgs → dispatch(login|repl|oneshot)
    cli/args.ts         argv → { command, prompt?, model?, help, version }
    auth/
      pkce.ts           generatePKCE(): {verifier, challenge}
      constants.ts      OAuth 常量（见 spec-002）
      callback-server.ts startCallbackServer(state): 监听 127.0.0.1:1455
      oauth.ts          login(): 完整流程; refresh(refreshToken)
      token-store.ts    load/save/isExpired/ensureValid，~/.kaleid/auth.json
    provider/
      types.ts          LLMProvider / ChatMessage / ToolCall / ToolSchema / StreamEvent
      openai-codex.ts   OpenAICodexProvider（Responses API over chatgpt backend）
      responses-encode.ts ChatMessage[] → Responses input items
      responses-sse.ts  SSE 解析 → StreamEvent
    tools/
      types.ts          Tool 接口 / ToolResult / ToolContext
      truncate.ts       截断工具（常量+算法）
      bash-executor.ts  executeBash() chokepoint
      read.ts write.ts edit.ts bash.ts
      index.ts          registry + toToolSchemas()
    loop/
      types.ts          AgentEvent / RunOptions
      session.ts        Session（内存 + compaction/persist 钩子）
      system-prompt.ts  buildSystemPrompt()
      agent-loop.ts     runTurn()
    modes/
      one-shot.ts       单次 → stdout 流式
      repl.ts           → tui/app
    tui/
      app.tsx           ink REPL（<Static> 防闪）
      components/{Message,ToolCall,StatusLine}.tsx
```

---

# spec-001 — 项目骨架 + npm 打包 + 构建
> 编号：spec-001 / 模块：scaffold / 依赖：无 / 状态：⬜

## 目标
clean-room TS+Node(v24) 骨架，可构建、可全局安装为 `kaleid`。

## 实现要求
**package.json**
```json
{
  "name": "kaleid", "version": "0.1.0", "type": "module",
  "bin": { "kaleid": "./dist/index.js" },
  "engines": { "node": ">=22" },
  "scripts": {
    "build": "node esbuild.config.mjs",
    "dev": "tsx src/index.ts",
    "typecheck": "tsc --noEmit",
    "start": "node dist/index.js"
  },
  "dependencies": { "ink": "^5", "react": "^18", "ink-text-input": "^6", "ink-spinner": "^5", "zod": "^3" },
  "devDependencies": { "typescript": "^5.6", "tsx": "^4", "esbuild": "^0.24", "@types/node": "^22", "@types/react": "^18" }
}
```
- **不引** pi / openai SDK / anthropic SDK（OpenAI 调用走原生 `fetch`+SSE 自写）。
- **tsconfig**：`module:ESNext`、`moduleResolution:bundler`、`jsx:react-jsx`、`target:ES2022`、`strict:true`、`esModuleInterop:true`、`skipLibCheck:true`。
- **esbuild.config.mjs**：entry `src/index.ts` → `dist/index.js`，`format:esm`、`platform:node`、`target:node22`、`bundle:true`、`banner.js:"#!/usr/bin/env node"`，`external` 留 ink/react（运行时依赖随包装）。构建后 `chmod +x dist/index.js`。
- **src/index.ts**（骨架）：`parseArgs(process.argv.slice(2))` → switch 分派（login/repl/oneshot 占位，后续 spec 填充），`--help`/`--version` 实现。

## 验收标准
1. WHEN `npm install && npm run build` THEN 产出可执行 `dist/index.js`，无类型/构建错误。
2. WHEN `npm i -g . && kaleid --help` THEN 打印 usage（含 `kaleid login` / `kaleid` / `kaleid "<prompt>"` / `--model`）。
3. WHEN `kaleid --version` THEN 打印 package.json version。
4. WHEN `npm run typecheck` THEN 0 error。

## 安装与发布（公网 npm，kaleid 将公开发布）
- **包名**：`kaleid`（npm 上未被占用，直接用，非 scoped）。
- **打包策略**：esbuild `bundle:true` 把运行时依赖（ink/react 等）**一起打进 `dist/index.js`**（单文件、安装零额外 node_modules），`files` 字段只发 `dist/` + README + LICENSE。
- **LICENSE**：MIT（与 pi 一致），仓库根加 `LICENSE` 文件。
- **README（面向公众，英文为主）**：项目简介 + 安装 (`npm i -g kaleid`) + `kaleid login`（说明用自己的 ChatGPT 账号登录）+ `kaleid` / `kaleid "<prompt>"` 用法 + 默认模型 + 免责声明（用 ChatGPT 订阅经 OAuth，受 OpenAI 政策约束，凭证仅存本地 `~/.kaleid/auth.json`）。
- **package.json 发布字段**：`name/version/description/bin/files/license:"MIT"/repository/keywords/engines`，`"publishConfig":{"access":"public"}`。
- **发布流程**（脚本化）：`npm run build` → `npm version <patch|minor>`（打 git tag）→ `npm publish --access public` → push tag + GitHub Release。`prepublishOnly` 跑 build + typecheck。
- **可选 CI**：GitHub Actions 在 push tag (`v*`) 时自动 build + `npm publish`（用 `NPM_TOKEN` secret）。V1 可先手动发，CI 作为加分项。

## 涉及文件（新建）
`package.json` / `tsconfig.json` / `esbuild.config.mjs` / `README.md` / `LICENSE` / `src/index.ts` / `src/cli/args.ts` / （可选）`.github/workflows/publish.yml`

---

# spec-002 — OAuth（OpenAI Codex / ChatGPT 登录）+ 凭证存储
> 编号：spec-002 / 模块：auth / 依赖：spec-001 / 状态：⬜

## 目标
实现 ChatGPT 账号 OAuth 登录（Codex 订阅路径），拿到并持久化可自动刷新的访问凭证。

## 常量（auth/constants.ts，照搬 pi 公开值）
```ts
export const CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
export const AUTHORIZE_URL = "https://auth.openai.com/oauth/authorize";
export const TOKEN_URL     = "https://auth.openai.com/oauth/token";
export const REDIRECT_URI  = "http://localhost:1455/auth/callback";
export const CALLBACK_HOST = "127.0.0.1";
export const CALLBACK_PORT = 1455;
export const SCOPE = "openid profile email offline_access";
export const JWT_CLAIM_PATH = "https://api.openai.com/auth"; // access JWT 里 chatgpt_account_id 所在 claim
export const ORIGINATOR = "kaleid"; // pi 用 "pi"；kaleid 用自己的
```

## PKCE（auth/pkce.ts，Web Crypto）
```ts
export async function generatePKCE(): Promise<{ verifier: string; challenge: string }>
// verifier = base64url(32 随机字节); challenge = base64url(SHA-256(verifier)); method S256
```

## authorize URL 构造（oauth.ts）
query 参数（全部必带）：`response_type=code`、`client_id=CLIENT_ID`、`redirect_uri=REDIRECT_URI`、`scope=SCOPE`、`code_challenge=<challenge>`、`code_challenge_method=S256`、`state=<16字节hex>`、`id_token_add_organizations=true`、`codex_cli_simplified_flow=true`、`originator=kaleid`。

## 本地回调服务器（auth/callback-server.ts）
- `http.createServer` 监听 `127.0.0.1:1455`。
- 仅处理 `GET /auth/callback`：校验 `state` 一致 → 取 `code` → 返回 200 HTML（"OpenAI 认证完成，可关闭此窗口"）→ resolve `{code}`；state 不符返回 400；无 code 返回 400。
- 暴露 `waitForCode(): Promise<{code}|null>`、`close()`、`cancelWait()`。
- 端口被占用 → 优雅失败（resolve null，走手动粘贴兜底）。

## 登录流程（oauth.ts `login()`）
1. `generatePKCE()` + 生成 state；构造 authorize URL。
2. `startCallbackServer(state)`。
3. 打开浏览器（`open` 包或平台命令；失败则 stdout 打印 URL）。
4. `await server.waitForCode()`；兜底：同时允许用户**手动粘贴** code 或完整回调 URL（解析其中 `code`/`state`，校验 state），二者竞速先到先用。
5. POST `TOKEN_URL`（`Content-Type: application/x-www-form-urlencoded`）：
   ```
   grant_type=authorization_code & client_id & code & code_verifier=<verifier> & redirect_uri
   ```
   → 响应 `{ access_token, refresh_token, expires_in }`。
6. 解码 access_token（JWT，三段，base64 解中段 JSON），取 `payload[JWT_CLAIM_PATH].chatgpt_account_id`。
7. 返回 `{ access, refresh, expires: Date.now()+expires_in*1000, accountId }`。
8. `finally` 关闭回调服务器。

## 刷新（oauth.ts `refresh(refreshToken)`）
POST `TOKEN_URL`：`grant_type=refresh_token & refresh_token & client_id` → 同样解析 + 重取 accountId。

## 凭证存储（auth/token-store.ts）
- 文件 `~/.kaleid/auth.json`，结构 `{ access, refresh, expires, accountId }`，写入权限 `0600`，目录 `~/.kaleid` 不存在则建。
- `load(): Creds | null`；`save(creds)`；`isExpired(creds): boolean`（`Date.now() >= expires - 60_000`）。
- `ensureValid(): Promise<Creds>`：load → 若过期且有 refresh → `refresh()` 并 `save()` → 返回有效 creds；无凭证抛 `NotLoggedInError`。

## 验收标准
1. WHEN `kaleid login` 首次执行 THEN 打开浏览器完成授权，`~/.kaleid/auth.json`（权限 600）写入有效 `{access,refresh,expires,accountId}`，打印"登录成功"。
2. WHEN 浏览器无法打开 THEN stdout 打印授权 URL，且支持粘贴 code/回调 URL 完成登录。
3. WHEN state 不匹配 THEN 拒绝并报错（防 CSRF）。
4. WHEN access 过期但 refresh 有效，调用 `ensureValid()` THEN 自动刷新并回写，返回新 access。
5. IF 无 auth.json 调用 `ensureValid()` THEN 抛 NotLoggedInError（调用方提示 `kaleid login`）。

## 涉及文件（新建）
`src/auth/{constants,pkce,callback-server,oauth,token-store}.ts`

## 依赖
外部：`auth.openai.com`（OAuth）。仅 `open`（打开浏览器）可选小依赖，或用平台命令自写。

---

# spec-003 — LLMProvider 接口 + OpenAICodexProvider（Responses API）
> 编号：spec-003 / 模块：provider / 依赖：spec-001, spec-002 / 状态：⬜

## 目标
定义 provider 抽象，实现走 ChatGPT backend Responses API 的 OpenAICodexProvider，支持多轮 + tool calling + 流式。

## 接口契约（provider/types.ts）
```ts
export interface ToolCall { id: string; name: string; arguments: Record<string, unknown>; }
export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  toolCalls?: ToolCall[];   // role=assistant
  toolCallId?: string;      // role=tool（对应某次 ToolCall.id）
}
export interface ToolSchema { name: string; description: string; parameters: object; } // JSON Schema
export type StreamEvent =
  | { type: "text"; delta: string }
  | { type: "tool_call"; toolCall: ToolCall }
  | { type: "done"; finishReason: "stop" | "tool_calls" | "length" };
export interface ChatParams {
  messages: ChatMessage[]; tools: ToolSchema[]; model: string;
  systemPrompt: string; signal?: AbortSignal; sessionId?: string;
}
export interface LLMProvider {
  readonly id: string; // "openai-codex"
  chat(params: ChatParams): AsyncIterable<StreamEvent>;
}
```

## 端点与 Header（openai-codex.ts，照搬 pi）
- **URL**：`https://chatgpt.com/backend-api/codex/responses`
- **Headers**：
  - `Authorization: Bearer <access_token>`（来自 `tokenStore.ensureValid()`）
  - `chatgpt-account-id: <accountId>`
  - `originator: kaleid`
  - `OpenAI-Beta: responses=experimental`
  - `accept: text/event-stream`
  - `Content-Type: application/json`
  - `session_id: <sessionId>`（可选，用 loop 的会话 id）
  - `User-Agent: kaleid/<version>`

## 请求体（responses-encode.ts → buildRequestBody，照搬 pi 字段）
```jsonc
{
  "model": "gpt-5.5",
  "store": false,
  "stream": true,
  "instructions": "<system prompt 文本>",
  "input": [ /* Responses input items，见下 */ ],
  "text": { "verbosity": "low" },
  "include": ["reasoning.encrypted_content"],
  "prompt_cache_key": "<sessionId，可选>",
  "tool_choice": "auto",
  "parallel_tool_calls": true,
  "tools": [ /* 见下 tools 编码 */ ]
}
```
**input items 编码**（ChatMessage → Responses input）：
- user/assistant 文本：`{ "type":"message", "role":"user|assistant", "content":[{"type":"input_text"|"output_text","text":"..."}] }`
- assistant 的 toolCalls：每个 → `{ "type":"function_call", "call_id":"<id>", "name":"<tool>", "arguments":"<JSON string>" }`
- tool 结果（role=tool）：`{ "type":"function_call_output", "call_id":"<toolCallId>", "output":"<string>" }`
**tools 编码**：每个 ToolSchema → `{ "type":"function", "name", "description", "parameters":<JSONSchema>, "strict":false }`

## SSE 解析（responses-sse.ts）
- 读 `response.body` 流，按 SSE 分帧（`data: <json>\n\n`，`[DONE]` 收尾）。
- 关注事件（OpenAI Responses 流式事件）：
  - `response.output_text.delta` → `{ type:"text", delta: ev.delta }`
  - `response.output_item.added` 且 item.type=`function_call` → 起一个 tool_call（暂存 call_id/name）
  - `response.function_call_arguments.delta` → 累加该 call 的 arguments 字符串
  - `response.output_item.done`（function_call）→ 解析 arguments JSON → emit `{ type:"tool_call", toolCall }`
  - `response.completed` / `response.done` → emit `{ type:"done", finishReason }`（有 tool_call 则 "tool_calls"，否则 "stop"）
  - `response.failed` / `response.incomplete` → 抛错（带原因）
- reasoning 相关事件 V1 忽略（不展示思考）。

## chat() 流程
1. `creds = await tokenStore.ensureValid()`（无凭证 → NotLoggedInError 向上抛）。
2. 组请求体 + headers，`fetch(URL,{method:"POST",headers,body,signal})`。
3. 401 → 强制 `refresh()` 重试一次；仍 401 → 抛"请重新 kaleid login"。
4. 429/usage limit → 抛明确错误（V1 不做复杂退避，提示用户）。
5. `for await` SSE → yield StreamEvent。

## 验收标准
1. WHEN 已登录 + `chat({messages,tools,model:"gpt-5.5",systemPrompt})` THEN 流式 yield text delta；模型决定调工具时 yield 完整 tool_call（arguments 为对象）。
2. WHEN 多轮（含 tool 结果回灌）THEN input items 正确编码 function_call / function_call_output，模型能继续。
3. IF access 401 THEN 自动刷新重试一次。
4. IF 未登录 THEN 抛 NotLoggedInError。
5. WHEN signal abort THEN fetch 中断、迭代结束。

## 涉及文件（新建）
`src/provider/{types,openai-codex,responses-encode,responses-sse}.ts`

## 依赖
spec-002（token）；外部 `chatgpt.com/backend-api/codex/responses`。
> 注：端点/header/字段值取自 pi 现网实现；若 OpenAI 侧协议变动，集中改 openai-codex.ts 即可。

---

# spec-004 — Tool 接口 + 4 工具 + bash chokepoint
> 编号：spec-004 / 模块：tools / 依赖：spec-001 / 状态：⬜

## 接口契约（tools/types.ts）
```ts
import type { z } from "zod";
export interface ToolResult { output: string; isError?: boolean; }
export interface ToolContext { cwd: string; signal?: AbortSignal; }
export interface Tool<I = any> {
  readonly name: "read" | "write" | "edit" | "bash";
  readonly description: string;          // 给 LLM
  readonly schema: z.ZodType<I>;         // 入参校验
  readonly jsonSchema: object;           // 同一 schema 的 JSON Schema（给 provider tools）
  readonly isReadOnly: boolean;          // read=true 其余 false（为后续权限留）
  activity(input: I): string;            // spinner 文案，如 "Reading src/x.ts"
  execute(input: I, ctx: ToolContext): Promise<ToolResult>;
}
```
`index.ts`：`export const tools: Tool[] = [readTool, writeTool, editTool, bashTool]`；`toToolSchemas(): ToolSchema[]`（name/description/jsonSchema）。

## 截断（tools/truncate.ts，照搬 pi 常量）
```ts
export const DEFAULT_MAX_LINES = 2000;
export const DEFAULT_MAX_BYTES = 50 * 1024; // 50KB
export function truncateHead(text, {maxLines, maxBytes}): { text, truncated, originalLines }
export function truncateTail(text, {maxBytes}): { text, truncated }
```

## read（isReadOnly=true）
- schema：`{ path: string; offset?: number /*1-indexed 起始行*/; limit?: number /*最大行数*/ }`
- 行为：UTF-8 读文件，输出**带行号**（右对齐，`<行号>\t<内容>`，从 offset 或 1 起）。无 offset/limit 时默认从头读，超 `DEFAULT_MAX_LINES`(2000) 或 `DEFAULT_MAX_BYTES`(50KB) 截断（`truncateHead`）并在末尾标注"… (truncated, N more lines)"。
- 错误：路径不存在 / 是目录 / 非 UTF-8 二进制 → `isError`，output 写明原因。
- activity：`Reading <relpath>`。

## write
- schema：`{ path: string; content: string }`
- 行为：父目录不存在则递归创建；写/覆盖；返回 `"Wrote <N> lines to <relpath>"`。
- activity：`Writing <relpath>`。

## edit
- schema：`{ path: string; old_string: string; new_string: string }`
- 行为：读文件 → 统计 `old_string` 出现次数：**必须恰好 1 次**，否则 isError（出现 0 次："old_string not found"；>1 次："old_string appears N times, must be unique — add surrounding context"）。唯一匹配则替换并写回，返回简短 diff 摘要（改动行附近 ±3 行）。
- 约束：`old_string` 应尽量小但唯一；`old_string != new_string`。
- activity：`Editing <relpath>`。

## bash（必经 chokepoint）
- schema：`{ command: string; timeout?: number /*秒，可选，无默认超时*/ }`
- 行为：**必须调 `executeBash()`**，禁止直接 spawn。返回合并的 stdout+stderr（按时间序）+ 末尾 `\n[exit code: <n>]`。
- activity：`Running: <command 前 60 字符>`。

## bash chokepoint（tools/bash-executor.ts）
```ts
export interface BashResult { output: string; exitCode: number | undefined; truncated: boolean; cancelled: boolean; }
export async function executeBash(command: string, opts: { cwd: string; signal?: AbortSignal; timeoutSec?: number }): Promise<BashResult>;
```
- 实现：`child_process.spawn("bash", ["-lc", command], {cwd})`，流式收集 stdout+stderr 合并缓冲。
- 超时：`timeoutSec>0` 时 setTimeout 到点 `killProcessTree(pid)`（杀整个进程组），标记 cancelled。
- AbortSignal：abort 时同样 killProcessTree。
- 输出截断：累计 > `DEFAULT_MAX_BYTES*2`(100KB) 截断尾部、`truncated=true`（保留头部 + 提示）。
- **设计意图（红线）**：confirm / sandbox / 权限校验 / 审计日志后续都只加在此函数，调用方不变（对标 Claude Code BashTool 把 security/permission/sandbox 全挂这一层）。

## 验收标准
1. WHEN read 一个 3000 行文件无 limit THEN 返回前 2000 行带行号 + 截断提示。
2. WHEN read `{path, offset:100, limit:20}` THEN 返回第 100–119 行，行号正确。
3. WHEN edit 的 old_string 出现 0 次或 >1 次 THEN isError 且**不改文件**，提示出现次数。
4. WHEN edit 唯一匹配 THEN 替换成功并回 diff 摘要。
5. WHEN write 父目录不存在 THEN 自动建目录并写入。
6. WHEN bash `"echo hi && exit 3"` THEN output 含 `hi` + `[exit code: 3]`，全程经 executeBash。
7. WHEN bash 超 timeout THEN 进程树被杀、标记 cancelled、返回已有输出。
8. WHEN bash 输出 >100KB THEN 截断 + truncated=true。
9. WHEN 工具入参不符 schema THEN execute 返回 isError（不抛未捕获异常）。

## 涉及文件（新建）
`src/tools/{types,truncate,bash-executor,read,write,edit,bash,index}.ts`

---

# spec-005 — Agent Loop + 消息层
> 编号：spec-005 / 模块：loop / 依赖：spec-003, spec-004 / 状态：⬜

## 消息层（loop/session.ts）
```ts
export interface Session {
  readonly id: string;                    // 用作 provider sessionId / prompt_cache_key
  messages: ChatMessage[];
  append(msg: ChatMessage): void;
  maybeCompact(): Promise<void>;          // V1 no-op（接口就位）
  persist(): Promise<void>;               // V1 no-op
}
export function createSession(): Session; // id = crypto.randomUUID()
```

## 内置 system prompt（loop/system-prompt.ts，改写自 pi）
```ts
export function buildSystemPrompt(cwd: string): string;
```
内容（固定，Q2 不做覆盖）：
```
You are kaleid, an expert coding assistant running in a terminal. You help the user by reading files, running shell commands, editing code, and writing files, using the provided tools.

Available tools:
- read: read a file (with line numbers; supports offset/limit)
- write: create or overwrite a file
- edit: exact unique-match string replacement in a file
- bash: run a shell command

Guidelines:
- Be concise and direct in your responses.
- Show file paths clearly when working with files.
- Prefer reading files before editing; keep edits minimal and targeted (edit's old_string must be unique).
- Use bash for exploration (ls, grep, find) and running builds/tests.
- After making changes, verify when possible (run the relevant command/test).

Current date: <YYYY-MM-DD>
Current working directory: <cwd>
```

## 循环（loop/agent-loop.ts）
```ts
export type AgentEvent =
  | { type: "assistant_text"; delta: string }
  | { type: "tool_start"; call: ToolCall; activity: string }
  | { type: "tool_end"; call: ToolCall; result: ToolResult }
  | { type: "turn_done"; final: ChatMessage }
  | { type: "error"; message: string };
export interface RunOptions { provider: LLMProvider; tools: Tool[]; model: string; cwd: string; signal?: AbortSignal; }
export async function* runTurn(session: Session, userInput: string, opts: RunOptions): AsyncIterable<AgentEvent>;
```
逻辑：
1. `session.append({role:"user", content:userInput})`；`await session.maybeCompact()`。
2. **inner loop**（最多 N=50 步防失控）：
   a. `stream = provider.chat({messages: session.messages, tools: toToolSchemas(opts.tools), model, systemPrompt: buildSystemPrompt(cwd), signal, sessionId: session.id})`
   b. 累积：text delta → yield `assistant_text`；收集 tool_call。
   c. SSE done：组 assistant message（text + toolCalls）`session.append(...)`。
   d. **无 toolCalls** → yield `turn_done`，return。
   e. **有 toolCalls**：逐个（按序）：
      - `tool = tools.find(name)`；找不到 → tool 结果 isError "unknown tool"。
      - yield `tool_start{call, activity}`；
      - `parsed = tool.schema.safeParse(call.arguments)`；失败 → result isError（schema 错误信息）；
      - 否则 `result = await tool.execute(parsed, {cwd, signal})`（execute 内部已 try/catch，自身异常也转 isError）；
      - yield `tool_end{call, result}`；
      - `session.append({role:"tool", toolCallId: call.id, content: result.output})`。
   f. 回到 a（不加新 user 消息，带着 tool 结果再问 LLM）。
3. 任意 provider 异常（含 NotLoggedIn / 401 / 网络）→ yield `error{message}` 并结束（不崩进程）。
- **mode-agnostic**：runTurn 只吃 `userInput` 字符串、吐 AgentEvent；REPL/one-shot 都消费同一接口。

## 验收标准
1. WHEN 任务需要工具 THEN 自动多轮调用直到无 tool_call，最后 turn_done。
2. WHEN 一轮多个 tool_call THEN 按序执行、各自 tool_end + 回灌。
3. WHEN 工具 isError THEN 错误回灌 LLM，loop 继续，不崩。
4. WHEN provider 抛错（如未登录）THEN yield error 事件并优雅结束。
5. WHEN 达到 50 步上限 THEN 安全停止并 yield error("step limit")。
6. WHEN signal abort THEN 尽快停止。
7. maybeCompact/persist 为 no-op 但接口存在、被调用。

## 涉及文件（新建）
`src/loop/{types,session,system-prompt,agent-loop}.ts`

---

# spec-006 — CLI 入口 + 交互模式
> 编号：spec-006 / 模块：cli / 依赖：spec-005 / 状态：⬜

## 用法
| 用法 | 行为 |
|---|---|
| `kaleid login` | spec-002 OAuth 登录 |
| `kaleid logout` | 删除 ~/.kaleid/auth.json（附带，简单）|
| `kaleid`（无参）| REPL（spec-007 ink TUI）|
| `kaleid "<prompt>"` / `kaleid -p "<prompt>"` | one-shot：单轮跑完，纯 stdout 流式，不进 TUI |
| flags | `--model <id>`（默认 gpt-5.5）/ `--help` / `--version` |

## args.ts
`parseArgs(argv) → { command: "login"|"logout"|"repl"|"oneshot", prompt?: string, model?: string, help, version }`
- 规则：`login`/`logout` 显式子命令优先；`-p`/`--print` 或首个非 flag 位置参数 → oneshot（该参数即 prompt）；都无 → repl。`--model` 覆盖默认。

## 启动前置（repl / oneshot）
- `await tokenStore.ensureValid()`；抛 NotLoggedInError → stderr 提示 `请先运行: kaleid login`，exit 1。

## one-shot（modes/one-shot.ts）
- 建 session/provider/tools；`for await (ev of runTurn(session, prompt, opts))`：
  - `assistant_text` → `process.stdout.write(delta)`
  - `tool_start` → stderr 打 `· <activity>`（不污染 stdout 主输出）
  - `tool_end` → stderr 打结果首行摘要
  - `error` → stderr + exit 1
  - `turn_done` → 补换行，exit 0

## repl（modes/repl.ts）
- 渲染 spec-007 ink app，注入 session/provider/tools/runTurn。

## 验收标准
1. WHEN `kaleid login` THEN 完成 OAuth（spec-002 验收）。
2. WHEN `kaleid "读 package.json 并说有哪些 script"` THEN one-shot 流式输出到 stdout，退出 0。
3. WHEN `kaleid` 无参 THEN 进 REPL。
4. WHEN 未登录跑 repl/oneshot THEN 提示 kaleid login 且 exit 1。
5. WHEN `--model gpt-x` THEN 覆盖默认 gpt-5.5。
6. WHEN `kaleid logout` THEN 删除凭证文件。

## 涉及文件
修改 `src/index.ts`、`src/cli/args.ts`；新建 `src/modes/{one-shot,repl}.ts`

---

# spec-007 — 简单 TUI（ink，防闪）
> 编号：spec-007 / 模块：tui / 依赖：spec-005, spec-006 / 状态：⬜

## 目标
REPL 的 ink 界面：输入 + 流式 + 工具可视化 + 状态，**无闪烁**。参考可跑 demo：`~/kaleid-tui-demos/ink-demo/src/app.tsx`。

## 状态模型（app.tsx）
```ts
history: Msg[]           // 已完成消息 → 进 <Static>，永不重绘
streaming: string | null // 正在流式的 assistant 文本（动态区）
status: string | null    // "thinking…" | "running <tool>…" | null
input: string            // 输入框内容
busy: boolean            // 处理中禁用输入
```
- `Msg = { id; role:"user"|"assistant"|"tool"; text; tool?:{name,args,resultSummary} }`

## 渲染（防闪硬要求）
- `<Static items={history}>` 渲历史（**渲一次、永不重绘** → 无闪烁）。
- 动态区（Static 之下）：streaming 文本（青）+ status（spinner，黄）+ 输入框（`ink-text-input`，仅 `!busy` 时显示）。
- 消息完成立即 commit 进 history（从动态区移除）。

## 事件接线
- 提交输入：`setBusy(true)`；commit user Msg；`for await (ev of runTurn(...))`：
  - `assistant_text` → 累加 streaming
  - 一轮 assistant 文本完（出现 tool_start 或 turn_done 前）→ commit assistant Msg、清 streaming
  - `tool_start` → `setStatus("running "+ev.activity)`
  - `tool_end` → commit tool Msg（name+args+result 首行摘要）、清 status
  - `turn_done` → 确保末条 assistant 已 commit；`setBusy(false)`
  - `error` → commit 一条红色错误 Msg；`setBusy(false)`
- 组件：`components/Message.tsx`（按 role 上色）、`ToolCall.tsx`（紫，⏺name(args) + ✔/✘ + 结果摘要）、`StatusLine.tsx`（`ink-spinner` dots + 文案）。

## 交互
- 回车提交（busy 时忽略）；`exit`/`quit` 退出；Ctrl+C：busy 时 abort 当前 turn（AbortController），空闲时退出。

## 不做（留后续）
主题 / 模型·会话选择器 / diff 高亮 / 自定义键位 / 自研差分渲染器。

## 验收标准
1. WHEN 多轮累积长历史 THEN 历史区不重绘、无整屏闪烁（Static 生效）。
2. WHEN assistant 流式 THEN 文本逐步出现、仅动态区刷新。
3. WHEN 调工具 THEN spinner + activity 文案；完成后结果进历史区。
4. WHEN Ctrl+C（busy）THEN 中断当前 turn；空闲再按退出。
5. WHEN 窗口小/输出长 THEN 无整屏闪烁或错位。

## 涉及文件（新建）
`src/tui/app.tsx`、`src/tui/components/{Message,ToolCall,StatusLine}.tsx`

---

## 全局 V1 DoD（对应 PRD §五）
1. `kaleid login` 完成 OAuth，凭证持久化(~/.kaleid/auth.json)+自动刷新。
2. read/write/edit/bash 经统一 Tool 接口被 LLM 正确调用回灌；bash 全经 executeBash。
3. REPL（ink 无闪）+ one-shot 共用 runTurn。
4. `npm i -g` 后 `kaleid` 可运行，默认 gpt-5.5。
5. 扩展点就位：LLMProvider / executeBash chokepoint / Tool 接口 / runTurn 输入源抽象 / session.maybeCompact+persist 钩子。

## Multica 并行实施建议
- 串：spec-001（骨架）先行。
- 并行：spec-002（auth）/ spec-004（tools）可同时；spec-003（provider）依赖 002。
- 汇：spec-005（loop）依赖 003+004 → spec-006（cli）→ spec-007（tui）。
- **测试不烧真订阅**：provider 用假 SSE fixture 单测；OAuth 用假 token endpoint；工具用临时目录。借鉴 pi faux provider 思路。
