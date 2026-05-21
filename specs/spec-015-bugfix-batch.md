---
项目: kaleid
文档: spec-015 — 0.0.8 实测 bugfix 批（DeepSeek reasoning_content / Codex system 消息 / slash 双回车）
作者: kaleidLead
生成时间: 2026-05-22
Reviewer: ByAnDa
上游: spec-013(openai-compat) / spec-003(Codex Responses) / spec-008(slash) / spec-010(TUI)
状态: 待实现
编号: spec-015
依赖: 0.0.8（dev）
类型: Bugfix 批（真实使用暴露）
---

# spec-015 — 0.0.8 实测 bugfix 批（3 个）

> ByAnDa 实测 0.0.8 暴露 3 个 bug：
> ① DeepSeek `400: reasoning_content ... must be passed back`（msg=f4f003af）
> ② OpenAI Codex `400: System messages are not allowed`（msg=603857a4）
> ③ slash 命令按回车不直接执行、要按两次（msg=9281e125）

---

# Bug ① — 修复 DeepSeek `reasoning_content` 400

> DeepSeek 模型报 `400: The reasoning_content in the thinking mode must be passed back to the API`。

## 根因
DeepSeek 推理/thinking 模型在响应里返回 `reasoning_content`；其 API 要求**多轮回传时，每条 assistant 消息都必须带 `reasoning_content` 字段**（thinking 启用时；哪怕空字符串）。kaleid 的通用 openai-compat provider：
- `ChatMessage`（`src/provider/types.ts`）只有 content + toolCalls + toolCallId，**没有 reasoning_content 字段**。
- 流式解析（`src/provider/openai-compat.ts`）只取 `delta.content` + `delta.tool_calls`，**未捕获 `delta.reasoning_content`**。
- `encodeChatMessages` 编码 assistant 消息时**未带 reasoning_content**。
→ 第二次请求（多轮 / 工具调用回灌）时 input 里的 assistant 消息缺 reasoning_content → DeepSeek 400。

pi 已踩过并解决（`packages/ai/src/providers/openai-completions.ts`）：捕获 `reasoning_content`/`reasoning`/`reasoning_text`；回传时若 assistant 的 reasoning_content 缺失则补 `""`。

## 变更详述

### 1. ChatMessage 增加 reasoningContent（src/provider/types.ts）
- `interface ChatMessage` 加可选 `reasoningContent?: string`（仅 assistant 用）。

### 2. openai-compat 捕获 reasoning（src/provider/openai-compat.ts）
- 流式解析时，除 `delta.content` / `delta.tool_calls` 外，累积 `delta.reasoning_content`（兼容 `delta.reasoning` / `reasoning_text` 作 fallback）到当前 assistant 的 reasoningContent。
- done 时把 reasoningContent 一并写入产出的 assistant ChatMessage。
- （reasoning_content 是模型思考过程，**不展示给用户 / 不计入对话正文**，只用于回传；UI 不变。）

### 3. encodeChatMessages 回传 reasoning_content（src/provider/openai-compat.ts）
- 编码 **assistant** 消息时带 `reasoning_content` 字段：
  - 有捕获到的 reasoningContent → 带真值；
  - 没有（或为 undefined）→ 带 `""`（空字符串）。
- 仅 assistant 消息带；user/system/tool 不带。
- 该字段对 DeepSeek thinking 必需；对其它 OpenAI 兼容后端（Kimi 等）带空串一般无害——如个别后端报错，可按 provider/baseURL gate 只对 deepseek 带（实装择一，优先通用带 ""，有兼容问题再 gate）。

### 4. 不影响 Codex / 其它
- OpenAI Codex（Responses API，另一条 provider）不走 openai-compat，不受影响。
- 持久化（spec-014 jsonl）：assistant entry 顺带存 reasoningContent，resume 后回传仍正确（建议覆盖）。

## Bug ① 验收
1. WHEN 用 DeepSeek 多轮 / 工具调用回灌 THEN 不再报 reasoning_content 400，正常多轮。
2. WHEN DeepSeek 响应带 reasoning_content THEN 捕获存入 assistant ChatMessage，但不显示在对话正文。
3. WHEN 编码请求 THEN 每条 assistant 消息带 `reasoning_content`（真值或 ""）。
4. WHEN Kimi / 其它 openai-compat THEN 不回归。
5. WHEN resume 含 DeepSeek 历史的会话 THEN reasoning_content 正确回传可续。

## Bug ① 涉及文件
- `src/provider/types.ts`（ChatMessage 加 reasoningContent）/ `src/provider/openai-compat.ts`（捕获+回传）/ `src/loop/session-store.ts`（jsonl 存读）

---

# Bug ② — 修复 OpenAI Codex `System messages are not allowed` 400

## 根因
Codex Responses API 的 system prompt 只能进 `instructions` 字段，**`input` 里不允许 system 角色消息**。但 `src/provider/responses-encode.ts` 的 `encodeMessages` 对任意有 content 的消息（含 `role==="system"`）都生成 `{type:"message", role: message.role, ...}` 放进 `input` → 一旦 messages 里出现 system 角色消息（如 spec-014 的 compaction 摘要、或其它注入），Codex 报 400。

## 修法
- `encodeMessages` **不得把 `role==="system"` 的消息放进 Responses `input`**：
  - 普通 system 内容：本就由 `params.systemPrompt → instructions` 承载，input 里直接跳过 system 消息。
  - 若有承载语义的 system 消息（如 compaction 摘要）：表示为 **user 或 assistant** 文本进 input（不要用 system 角色）。建议 compaction 摘要在 loop/session 层就用非 system 角色（如 user 角色的"[历史摘要] ..."），从源头避免 system 进 input。
- 仅影响 Codex（Responses）；openai-compat（DeepSeek/Kimi 允许 system）不受影响，但 compaction 摘要改非 system 角色后两边都干净。

## Bug ② 验收
6. WHEN 用 OpenAI Codex 多轮对话 / 触发压缩后继续 THEN 不再报 `System messages are not allowed` 400。
7. WHEN messages 含 system 角色（如压缩摘要）THEN Codex 编码时不出现在 input 的 system 角色项（system prompt 仍走 instructions）。
8. WHEN 压缩摘要 THEN 以非 system 角色承载，Codex / DeepSeek / Kimi 都正常。

## Bug ② 涉及文件
- `src/provider/responses-encode.ts`（input 不含 system 角色）/ `src/loop/compaction.ts`（摘要用非 system 角色）

---

# Bug ③ — slash 命令回车直接执行（去掉双回车）

## 现象
执行 slash 命令时，按回车只是把命令补全填进输入框（autocomplete），要再按一次回车才执行。

## 修法
- slash 菜单可见 / 输入是合法 slash 命令时，**按一次回车直接执行该命令**（不要只做补全填充再等第二次回车）。
- 保留 Tab 做补全（如需），但 **Enter = 执行**。若菜单有高亮项且输入还不完整，Enter 可"补全并执行"高亮项（一次到位），不要求二次回车。
- Esc 仍关闭菜单。

## Bug ③ 验收
9. WHEN 输入 `/help` 后按回车（一次）THEN 直接执行 /help，不需要第二次回车。
10. WHEN slash 菜单高亮某命令按回车 THEN 直接执行该命令（一次到位）。
11. WHEN 普通文本回车 THEN 照常作为 prompt 提交（不回归）。

## Bug ③ 涉及文件
- `src/tui/app.tsx` / `src/tui/components/InputBar.tsx`（slash 提交逻辑：Enter 直接执行）

---

## 通用约束
clean-room；测试用 fake（DeepSeek SSE 带 reasoning_content + 多轮回传断言 / Codex 编码不含 system / slash Enter 一次执行）；typecheck/test/build/pack 全绿；pack 仍 3 文件。

## 发布
self-merge 到 dev 后作为 **0.0.9** 发布（发布动作由项目所有者执行）。
