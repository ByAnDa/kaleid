---
项目: kaleid（ByAnDa 自用 Harness Agent / 终端编码 agent）
PM: kaleidLead（暂代 — kaleid 无独立 PM）
Reviewer: ByAnDa
上游流程文档: 《工程开发总流程 v1》cluster meta SOP — `<KB>/技术经验共享/工程开发总流程 v1.md`；本 PRD 对应 stage 2 PRD。kaleid V1 = CLI/工具型项目，仅终端 TUI、无 web/app 视觉设计 → **stage 3 Claude Design skip**。流程：PRD → spec(kaleidLead 自起) → 委派 Multica。
版本: v0.3（全部决策锁定：路线/provider(OpenAI Codex OAuth, gpt-5.5)/D1-D5/Q1/Q2）
生成时间: 2026-05-21 起草 / 2026-05-22 v0.3 定稿（kaleidLead）
代码地址: 本地 ~/repos/kaleid / GitHub https://github.com/ByAnDa/kaleid（ByAnDa msg=de1f217a 确认）
状态: **全部决策锁定，待 ByAnDa Gate 1 放行 → 即进 spec（Stage 4）**
用途: kaleid 项目产品需求文档，spec 工作流的产品端输入源

变更日志:
- v0.3（2026-05-22）：定稿版。provider 锁定 **OpenAI Codex OAuth + 默认模型 gpt-5.5**（ByAnDa msg=99cf6142 + da363b14）；修正 2.1 表 F1 与 out-of-scope 残留的旧 Claude 表述；Q1/Q2 状态从"默认"改为"锁定"。全部 D1-D5 + Q1/Q2 无开放项。
- v0.2（2026-05-21~22）：① 路线 (a) clean-room（msg=383a0a43）② TUI 选 ink（msg=27432843）③ 项目与 @Architect 无关、kaleidLead 独立负责（msg=27432843）④ Q2 不做覆盖、Q1 确认（msg=8dd0f5fb）⑤ provider 改 OpenAI Codex OAuth（msg=99cf6142）。并入 pi/Claude Code 对比的设计回流。
- v0.1（2026-05-21）：初稿。
---

# kaleid PRD v0.3 — V1 最小 Harness 内核

> **本文档作用**：把 ByAnDa 的"自用 harness agent"想法落成可被 spec 工作流消费的需求文档。
>
> **本版边界**：只覆盖 **V1 最小 MVP**。终态愿景（tmux 全 pane context + Slack bot 深度集成）是后续版本增量，V1 不实施。
>
> **核心原则**：ByAnDa 要"最小步进、一步步搭"。V1 把"provider + 工具 + agent loop + 简单 TUI + npm 打包"这个内核做扎实，后续能力作为增量挂上来。
>
> **路线（已定）**：(a) **clean-room 自研** —— 依 pi 架构与 Claude Code 经验从零最小实现，**大量借鉴设计模式但不依赖/复制其代码**。

---

## ⭐ 重点借鉴项目（ByAnDa msg=bedbf288 指定，长期记忆）

kaleid 自研以这两个项目为主要架构/经验参考（仅借鉴设计模式，不依赖/复制代码）：

1. **pi** — https://github.com/earendil-works/pi
   - 中量级开源 agent harness。4 包 monorepo：pi-ai(多 provider + OAuth) / pi-agent-core(loop+工具+状态) / pi-coding-agent(read/bash/edit/write+session+模式) / pi-tui。
   - **OpenAI Codex OAuth 实现参考**：`pi-ai/utils/oauth/openai-codex.ts` + `pkce.ts` + `providers/openai-codex-responses.ts`。
   - 详见 `kaleid V1 vs pi 详细对比.md`。
2. **Claude Code（泄露源码镜像）** — https://github.com/yasasbanukaofficial/claude-code
   - 满配生产级终态参考。自研 Ink 渲染器(防闪) / Tool 接口 / BashTool 安全分层 / compact+autoDream 记忆。
   - 详见 `kaleid V1 vs Claude Code 详细对比.md`。

借鉴要点（已并入本 PRD）：统一 Tool 接口趁早定 / bash 单 chokepoint / TUI Static 防闪 / loop 预留 compaction+session 接口 / OpenAI Codex OAuth 流程。

---

## 一、产品定位

### 1.1 一句话定位

> kaleid 是 ByAnDa **自用的终端 Harness Agent**：用 OpenAI Codex OAuth（ChatGPT 订阅）接入 LLM，具备 read / write / edit / bash 四项核心工具，能在终端里（带简单 TUI）自主完成编码与文件操作任务，打包成 npm CLI 直接调用。

### 1.2 设计理念

- **自用工具**，非对外产品 —— 优先实用与可控，不做面向多用户的复杂度。
- **最小内核 + 增量演进** —— V1 只做能跑通核心循环的最小集合；tmux / Slack 等高级能力分版本叠加。
- **结构 future-proof, scope 最小** —— V1 范围严格收窄，但关键扩展点（provider 抽象 / bash chokepoint / loop 输入源抽象 / Tool 接口 / session+compaction 预留）就位，让后续增量 0 重构挂上。

---

## 二、V1 范围（MVP）

### 2.1 In-scope（V1 必做）

| # | 能力 | 说明 |
|---|---|---|
| F1 | **AI provider 接入** | **OpenAI Codex OAuth**（ChatGPT 订阅，默认模型 gpt-5.5）跑通多轮 chat + tool calling + 流式。`LLMProvider` 薄抽象 + `OpenAICodexProvider` 实现 |
| F2 | **4 个核心工具** | `read`（读文件）/ `write`（写文件）/ `edit`（精确替换）/ `bash`（执行命令），统一 `Tool` 接口 |
| F3 | **agent loop** | 收任务 → LLM 决策 → 调工具 → 回灌结果 → 循环至任务完成。loop 内核 mode-agnostic |
| F4 | **两种交互模式** | REPL（终端多轮对话）+ one-shot（`kaleid "task"` 单次跑完）。共用同一 loop |
| F5 | **简单 TUI** | REPL 模式的轻量终端界面（**ink 实现**）：输入区 + 流式渲染 + 工具调用可视化 + 状态提示 |
| F6 | **npm 打包** | 装成 CLI（`npm i -g` 或 `npx`），`kaleid` 可执行入口 |

### 2.2 Out-of-scope（V1 非目标，后续版本）

| 能力 | 归属版本 |
|---|---|
| tmux 全 pane context 获取 | 后续（终态愿景 Part 1）|
| Slack bot 深度集成（Socket Mode + Bolt）| 后续（终态愿景 Part 2）|
| 其它 provider 实现（Claude / Gemini 等）| V2+（V1 仅 OpenAI Codex；`LLMProvider` 接口已为多 provider 留位）|
| API key 模式（非 OAuth）| 后续（V1 只走 OAuth）|
| bash confirm / sandbox / 超时控制 | V1 后（V1 直接执行，走单一 chokepoint 预留）|
| 富 TUI（主题 / 选择器 / diff 高亮 / 自研差分渲染器 / 键位系统）| 后续 |
| 会话持久化 / fork / resume | V1 后（V1 会话纯内存，但预留 session 接口）|
| 上下文 compaction（自动压缩）| V1 后（V1 预留 loop/消息层接口）|
| 实时流 / context 分层聚合 / 可写 tmux actuator | 后续 / 远期 |

---

## 三、功能需求详述

### F1 — AI Provider 接入（OpenAI Codex OAuth，ByAnDa msg=99cf6142 + da363b14 定）
- V1 provider = **OpenAI Codex OAuth**（用 ChatGPT Plus/Pro 账号登录，走 Codex 订阅额度，非 API key 按量付费；同 Codex CLI 路径）。
- 抽象成 `LLMProvider` interface（约 3-5 方法 `chat(messages, tools) → {text, toolCalls}` + `stream()`），V1 实现 = `OpenAICodexProvider`；Claude/其它退为后续 alt impl，抽象不变、0 浪费。
- **clean-room 自写**，借鉴 pi `pi-ai/utils/oauth/openai-codex.ts` 实现思路（不复制代码）。
- **OAuth 流程**：
  1. 登录（`kaleid login`）：PKCE(S256)+state → 浏览器开 `auth.openai.com/oauth/authorize`（Codex 公开 client_id，scope `openid profile email offline_access`，redirect `localhost:1455/auth/callback`）→ 本地起 :1455 回调服务器拿 `code` → `code+verifier` 换 `access+refresh+expires` → 解 JWT 取 `chatgpt_account_id`。兜底手动粘贴 code/URL。
  2. 调用：base URL `https://chatgpt.com/backend-api`，OpenAI **Responses API**，带 `Bearer access_token` + `chatgpt-account-id` header。
  3. 刷新：access 到期用 refresh_token 自动换新。
- **凭证持久化**（必须）：access/refresh/expires/accountId 存 `~/.kaleid/auth.json`，启动读取 + 到期自动刷新。
- 默认模型：**gpt-5.5**（ByAnDa msg=da363b14 定），允许 env 覆盖。

### F2 — 4 个核心工具（统一 Tool 接口）
- **设计回流（来自 Claude Code / pi 对比）**：即便只 4 个工具，第一版就定**统一 `Tool` 接口** —— `name` + JSON/zod `inputSchema` + 执行 + 结果渲染分离 + `isReadOnly` 标记 + spinner 活动文案。4 个工具按同一模式实现，后续加工具零成本。
- `read(path)` — 读文件（带行号 / 大文件分段，spec 定）。
- `write(path, content)` — 写 / 覆盖文件。
- `edit(path, old, new)` — 精确字符串替换（old 须唯一匹配）。
- `bash(cmd)` — 执行 shell，返回 stdout/stderr/exit code。**V1 直接执行（信任本机），但必须走单一 chokepoint `executeBash(cmd)`** —— 后续加 confirm/sandbox/超时/日志只改这一处（Claude Code BashTool 把十几个安全/权限/sandbox 文件都挂在这一层，印证此设计）。
- 工具以 LLM tool/function calling schema 暴露给 provider。

### F3 — Agent Loop
- 经典 tool-use 循环：user input → LLM（带工具）→ 有 toolCalls 则执行并回灌 messages → 再调 LLM → 直到不再调工具（完成）输出最终回复。
- **mode-agnostic**：输入源抽象成"拿下一条 user input"，不关心来自 REPL 还是命令行参数。
- 维护会话 messages（system + 历史 + 工具结果）。
- 工具执行失败 / 异常回灌给 LLM 纠错（策略 spec 定）。
- **预留 compaction 接口 + session 接口**（V1 不实现，但 loop/消息层结构上留位，避免长会话时伤筋动骨）。

### F4 — 交互模式
- **REPL**：启动进交互循环，多轮输入，agent 持续对话 + 调工具（带 F5 TUI）。
- **one-shot**：`kaleid "帮我做 X"` 跑单轮后 exit（脚本化 / CI 用，纯 stdout 流式，不走 TUI）。
- 两者共用 F3 loop 内核，各为薄 entry wrapper。
- **system prompt（Q2 定）**：固定内置一个编码助手 system prompt，V1 不提供 `--system-prompt` 覆盖。
- 另含 **`kaleid login`** 子命令走 OAuth 登录流（见 F1）。

### F5 — 简单 TUI（ink 实现，已定）
**技术：ink（React for CLI）**，理由：品类标杆 Claude Code 也用 React+Ink；声明式、流式 + spinner + 状态切换天然好写、易扩展。

**做（边界）：**
- 输入区（多行可选）
- assistant 输出**流式渲染**（边生成边显示）
- 工具调用 / 执行可视化（区分 user / assistant / tool，工具名 + 关键参数 + 结果摘要）
- 基本状态提示（思考中 / 工具运行中 / 完成，带 spinner）

**防闪（硬要求，已验证方案）：**
- 已完成的历史消息进 `<Static>`（**渲一次、永不重绘**），只有"正在流式的那条 + spinner + 输入框"是动态小区域。
- 这是 Claude Code 早期闪烁的解法原理（闪烁源于重绘区域过大/未做差分，非 ink 本身）。参考 demo `~/kaleid-tui-demos/ink-demo`。

**不做（避免膨胀，留后续）：**
- 通用差分渲染库 / 主题系统 / 模型·会话选择器 / 设置弹窗 / diff 高亮 / 键位面板 / 自定义键位系统。
- one-shot 模式不需要 TUI。

### F6 — npm 打包
- TypeScript + Node（目标 v24 LTS）。打包成可全局安装 / npx 调用的 CLI，提供 `kaleid` 可执行入口。
- 含 JSX/TSX 构建（esbuild 或 tsx，因 ink 用 JSX）。
- 构建产物 + package.json bin 配置 + 基本 README（spec 定结构）。

---

## 四、技术决策（已锁定）

> 战略路线（ByAnDa msg=383a0a43）：**(a) clean-room 自研**，借鉴 pi / Claude Code 设计模式但不依赖/复制其代码。

| # | 决策 | 结论 | 来源 |
|---|---|---|---|
| D1 | Provider | 薄抽象 `LLMProvider` interface；**V1 实现 = OpenAI Codex OAuth**（ChatGPT 订阅），默认模型 **gpt-5.5**，Claude 退后续。自写，借鉴 pi 思路 | ✅ ByAnDa msg=99cf6142 + da363b14 |
| D2 | 语言 / runtime | **TypeScript + Node（v24 LTS）** | ✅ 定 |
| D3 | 交互模式 | **REPL + one-shot 都做，共用同一 loop** | ✅ 定 |
| D4 | bash 执行 | **直接执行 + 单一 chokepoint `executeBash()`**，安全/sandbox 留后续 | ✅ 定 |
| D5 | TUI 技术 | **ink** | ✅ ByAnDa msg=27432843 |
| Q1 | 持久化 / 配置 | **会话纯内存（不持久化）；loop/消息层预留 session+compaction 接口**。⚠️ 例外：**OAuth 凭证必须持久化**到 `~/.kaleid/auth.json`（access/refresh/expires/accountId）+ 自动刷新 | ✅ ByAnDa msg=8dd0f5fb + OAuth 凭证例外（msg=99cf6142）|
| Q2 | system prompt | **固定内置一个编码助手 system prompt，V1 不提供 `--system-prompt` 覆盖** | ✅ ByAnDa msg=8dd0f5fb |

---

## 五、成功标准 / V1 DoD

V1 视为完成需满足：
1. 完成 `kaleid login`（OpenAI Codex OAuth）后，能跑通真实任务（如"读 X、改 Y、跑测试"），agent 自主多轮调工具完成；凭证持久化，重启免重登，到期自动刷新。
2. read / write / edit / bash 四工具均可被 LLM 正确调用并回灌结果，统一 Tool 接口落地。
3. REPL（带 ink 简单 TUI，无闪烁）与 one-shot 两模式均可用。
4. `npm i -g`（或 npx）后 `kaleid` 命令可直接运行。
5. 关键扩展点（provider 接口 / bash chokepoint / loop 输入源抽象 / Tool 接口 / session+compaction 预留）就位，后续增量无需重构内核。

---

## 六、里程碑 / 版本路线

| 版本 | 内容 |
|---|---|
| **V1（本 PRD）** | OpenAI Codex OAuth provider + 4 工具 + agent loop + REPL/one-shot + 简单 TUI(ink) + npm 打包 |
| V2（后续） | tmux 全 pane context（只读，分层聚合）|
| V3（后续） | Slack bot 深度集成（Socket Mode + Bolt）|
| 远期 | bash sandbox / 会话持久化+compaction / 可写 tmux actuator / 其它 provider / 富 TUI |

---

## 七、风险 / 待确认

- **R1 交付节奏**：V1 估 ~数天（含 OAuth 流程约多 1 天），具体 spec 拆分后给工时。
- **R2 委派形态**：V1 走 Multica 委派（per ByAnDa 流程）。kaleid 为新项目，按《工程开发总流程 v1》新项目启动直接 Mode A。
- **R3 代码仓库**：✅ 本地 `~/repos/kaleid`（已 clone，空仓）/ GitHub `https://github.com/ByAnDa/kaleid`。
- 全部 D1-D5 + Q1/Q2 已锁定，无开放项。

---

## 维护者
- 起草 / 暂代 PM / Spec owner：@kaleidLead
- 拍板：@ByAnDa
