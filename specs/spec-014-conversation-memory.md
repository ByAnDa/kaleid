---
项目: kaleid
文档: spec-014 — 单对话记忆（token 显示 / 自动压缩 / /compact / 持久化+resume）
作者: kaleidLead
生成时间: 2026-05-22
Reviewer: ByAnDa
上游: spec-005(loop+session 预留 maybeCompact/persist 钩子) / spec-010(全屏 TUI) / spec-011(models.ts)
状态: 待实现
编号: spec-014
依赖: **spec-013（0.0.7）完成并合 dev 之后再实施**（顺序 012→013→014，ByAnDa msg=523f2f89）
类型: 会话记忆/上下文管理
---

# spec-014 — 单对话记忆

> 触发：ByAnDa msg=153dbfb8 + 523f2f89。参考 pi（jsonl + 自动压缩 keep-recent）/ Claude Code（micro+full compact + 警告）。
> 范围（ByAnDa 指定）：token 常显输入框下方 / 自动压缩 / `/compact` 手动 / 显示最大上下文窗口 / 当前上下文百分比 / 持久化磁盘 + resume。

## 背景
spec-005 已预留 `session.maybeCompact()` + `persist()` 钩子（现 no-op），本 spec 填实。

## 变更详述

### 1. token 跟踪 + 输入框下方常显
- 每轮取上下文 token：优先 provider 返回的 usage（OpenAI/Codex/兼容都回 `usage.prompt_tokens`/`total_tokens`），拿不到则按 messages 估算。
- **输入框下方常显一行状态**：`ctx <used> / <window> · <pct>%`（如 `ctx 12.3K / 272K · 4.5%`）。
  - `used` = 当前上下文 token（约等于下次请求的 input/prompt tokens）。
  - `window` = 当前模型的**最大上下文窗口**（per-model，配在 `src/provider/models.ts`，如 gpt-5.5=272000；各 provider/model 有自己的值，未知给保守默认）。
  - `pct` = used/window，百分比。
- 常显（不是临时）；每轮更新；接近上限（如 >85%）变色提示（借鉴 CC warning）。

### 2. 自动压缩（pi 式，单级）
- 配置（放 models.ts 或 config）：`reserveTokens`（默认 ~16384）、`keepRecentTokens`（默认 ~20000）。
- 触发：`used > window - reserveTokens` → 自动压缩。
- 策略：用 LLM（当前 provider/model）把**较旧的历史**总结成一条 compaction-summary 消息，**保留最近 keepRecentTokens 的原始消息**，旧的用摘要替代后继续对话。
- 摘要用专门 system prompt（总结目标：保留任务目标、关键决定、已改文件、未完成项）。
- 压缩在对话区给一条系统提示 `已压缩上下文（节省 ~N token）`；token 行随之更新。
- 填 `session.maybeCompact()`：每轮起调用。

### 3. `/compact` 手动命令
- slash 命令表加 `/compact`：立即触发一次压缩（即使未到阈值）。完成后提示压缩结果。

### 4. 持久化磁盘 + resume（ByAnDa：一起做）
- **持久化**：会话存为 jsonl，路径 `~/.kaleid/sessions/<session-id>.jsonl`，每条 entry（user/assistant/tool/compaction-summary）追加写；含 session 元数据（id、创建时间、model/effort、首条消息摘要作标题）。
- **resume**：
  - CLI flag：`kaleid --continue`（恢复最近一个会话）/ `kaleid --resume`（列出历史会话选一个，或 `--resume <id>`）。
  - 可选 slash：`/resume` 在 REPL 内打开会话选择器（复用 OptionSelector）。
  - 恢复时重建 messages（含已压缩摘要）、token 状态、model/effort，继续对话。
- 默认行为：无 flag = 新会话（仍持久化，便于以后 resume）。
- 隐私：会话内容仅本地；不上报。

### 5. TUI 布局影响
- 底部区：输入框 + **其下 token 状态行**（spec-010 全屏布局里固定在输入框下方）；防闪沿用 diff renderer（token 行变更只 patch 该行）。
- header（spec-011）仍显 model·effort，可不重复 token。

## 验收标准
1. WHEN 对话进行 THEN 输入框下方常显 `ctx used / window · pct%`，每轮更新，数值合理（used≈上次 prompt tokens，window=当前模型上下文窗口）。
2. WHEN used 超过 `window - reserve` THEN 自动压缩：旧历史被 LLM 摘要替代、保留最近上下文，对话区提示已压缩，token 行下降。
3. WHEN `/compact` THEN 立即压缩并提示结果。
4. WHEN 上下文接近上限（如 >85%）THEN token 行变色/提示。
5. WHEN `kaleid --continue` THEN 恢复最近会话并能接着对话；`--resume`/`/resume` 可选历史会话恢复。
6. WHEN 任意会话 THEN 内容持久化到 `~/.kaleid/sessions/<id>.jsonl`（含压缩摘要）。
7. WHEN 切换 model（不同 window）THEN token 行的 window/pct 随之更新。
8. clean-room；测试用 fake（压缩用 fake LLM、token 用 fake usage、resume 读写临时目录）；typecheck/test/build/pack 全绿；pack 仍 3 文件。

## 涉及文件（修改/新增）
- `src/loop/session.ts` — 实现 maybeCompact()（token 跟踪 + 自动压缩）+ persist()（jsonl 写）
- `src/loop/compaction.ts`（新建）— 压缩策略 + 摘要 prompt + keep-recent
- `src/loop/session-store.ts`（新建）— ~/.kaleid/sessions/<id>.jsonl 读写 + 列表 + resume
- `src/provider/models.ts` — 每模型加 contextWindow 字段
- `src/tui/app.tsx` / `components/` — 输入框下方 token 状态行（used/window/pct + 接近上限变色）
- `src/tui/commands.ts` — 加 `/compact`（+ 可选 `/resume`）
- `src/cli/args.ts` — `--continue` / `--resume [id]`
- `src/loop/agent-loop.ts` — 每轮取 usage、调 maybeCompact、persist
- `test/` — token 显示、压缩触发、/compact、jsonl 持久化、resume 覆盖

## 发布
self-merge 到 dev 后作为 **0.0.8** 发布（发布动作由项目所有者执行）。
