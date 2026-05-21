---
项目: kaleid
文档: spec-013 — 新增 DeepSeek / Kimi coding plan provider（多 provider 选择）
作者: kaleidLead
生成时间: 2026-05-22
Reviewer: ByAnDa
上游: spec-011(/model+/reasoning) / spec-012(模型清单+链式) / spec-003(LLMProvider 抽象)
状态: 待实现
编号: spec-013
依赖: **spec-012（0.0.6）完成并合 dev 之后再实施**（共享 models.ts/选择器，串行）
类型: 多 provider 扩展
---

# spec-013 — 新增 DeepSeek / Kimi coding plan provider

> 触发：ByAnDa msg=bec1c81f —— 选 model 时额外提供 DeepSeek API、Kimi coding plan 两个选项。
> DeepSeek 文档 https://api-docs.deepseek.com/zh-cn/ ；Kimi code 文档 https://www.kimi.com/code/docs/

## 背景 / 抽象
- 现有 V1 只有 OpenAI Codex（OAuth）。`LLMProvider` 抽象本就为多 provider 设计（spec-003 D1）。
- DeepSeek 与 Kimi coding **都是 OpenAI 兼容的 chat/completions + Bearer API key** → 用**一个通用 OpenAI 兼容 provider** 覆盖两者（参数化 baseURL + apiKey + model）。

## API 事实（已查文档）
| provider | baseURL | endpoint | auth | model id | 协议 |
|---|---|---|---|---|---|
| **deepseek** | `https://api.deepseek.com` | `/chat/completions` | Bearer `DEEPSEEK_API_KEY` | `deepseek-v4-pro` / `deepseek-v4-flash`（另有将弃用的 deepseek-chat/reasoner，不列）| OpenAI 兼容，支持 tool calls，SSE 流式 |
| **kimi**（coding plan）| `https://api.kimi.com/coding/v1` | `/chat/completions` | Bearer API key（kimi.com/code/console 取）| `kimi-for-coding`（统一 id，后端自动选最新）| OpenAI 兼容；tool calling 文档未明示，实装时验证（OpenAI 兼容端点一般支持）|

## 变更详述

### 1. 通用 OpenAI 兼容 provider（src/provider/openai-compat.ts，新建）
- 实现 `LLMProvider`：`chat({messages, tools, model, signal})`，POST `<baseURL>/chat/completions`，header `Authorization: Bearer <key>` + `Content-Type: application/json`，body 为标准 OpenAI chat completions（messages + tools + stream:true）。
- SSE 解析标准 OpenAI chat.completion.chunk（`choices[].delta.content` 文本、`choices[].delta.tool_calls` 工具调用、`finish_reason`）→ 复用/对齐现有 StreamEvent。
- 参数化：`{ id, baseURL, apiKey, defaultModel }`。DeepSeek 与 Kimi 各一个实例配置。
- clean-room 自写 fetch+SSE（不引 openai SDK）。

### 2. provider 注册 + 模型清单扩展（src/provider/models.ts）
- 每个模型项带 `provider` 字段。新增 deepseek / kimi 的模型条目：
  - `deepseek-v4-pro` [deepseek] / `deepseek-v4-flash` [deepseek]
  - `kimi-for-coding` [kimi]
  - （openai-codex 那批保持 spec-012 的列表）
- 选择器列表项显示 provider 标签（如 pi 的 `gpt-5.5 [openai-codex]` / `deepseek-v4-pro [deepseek]` / `kimi-for-coding [kimi]`）。
- DEFAULT 仍 `gpt-5.5`（openai-codex）。

### 3. /model 选择器：跨 provider
- `/model` 列出**全部 provider 的模型**（带 provider 标签），上下箭头高亮、回车应用。
- 选中某模型 = 同时确定其 provider。agent loop 调用时按当前模型的 provider 路由到对应 impl（codex-oauth / openai-compat）。
- effort 链式（spec-012）：**仅对支持 reasoning 的 provider（openai-codex）**接着弹 effort；DeepSeek/Kimi 跳过 effort（或置 N/A），给提示。

### 4. API key 处理（DeepSeek / Kimi）
- 来源优先级：环境变量（`DEEPSEEK_API_KEY` / `KIMI_API_KEY`）> 本地配置 `~/.kaleid/config.json`。
- 选中 deepseek/kimi 模型但无 key 时：**TUI 弹粘贴输入**（复用 spec-009 的粘贴模式）让用户输入 key，保存到 `~/.kaleid/config.json`（权限 600，按 provider 存）。
- key 仅存本地；不打印、不上报。

### 5. header
- 右上角仍 `model · effort`；effort 对非 codex 可显示 `-` 或省略。可附 provider 标签（可选）。

## 验收标准
1. WHEN `/model` THEN 列表含三类 provider 的模型并带标签：openai-codex（spec-012 列表）/ deepseek（v4-pro / v4-flash）/ kimi（kimi-for-coding）。
2. WHEN 选中 deepseek/kimi 模型且已配 key THEN 后续对话经对应 baseURL 的 /chat/completions 跑通（流式 + 工具调用回灌）。
3. WHEN 选中 deepseek/kimi 模型但无 key THEN TUI 提示并可粘贴输入 key，保存到 ~/.kaleid/config.json 后可用。
4. WHEN 选中 openai-codex 模型 THEN 仍走 OAuth（不变），并接着弹 effort（spec-012）。
5. WHEN 选 deepseek/kimi THEN 不强制 effort（reasoning 不适用则跳过/提示）。
6. WHEN 切换 provider/model THEN header 实时反映；agent loop 按当前模型 provider 路由。
7. clean-room；测试用 fake（各 provider 的 SSE/HTTP 全 mock，不连真实后端、不烧任何额度/key）；typecheck/test/build/pack 全绿；pack 仍 3 文件。

## 涉及文件（修改/新增）
- `src/provider/openai-compat.ts`（新建）— 通用 OpenAI 兼容 provider（DeepSeek/Kimi 共用）
- `src/provider/models.ts` — 加 deepseek/kimi 模型条目 + provider 字段/标签
- `src/provider/index.ts` 或路由 — 按当前模型 provider 选 impl（codex-oauth / openai-compat）
- `src/auth/config-store.ts`（新建，建议）— ~/.kaleid/config.json 存各 provider api key
- `src/tui/app.tsx` / `commands.ts` — /model 跨 provider、无 key 时粘贴输入、effort 仅 codex
- `src/loop/*` — runTurn 按 provider 路由
- `test/` — openai-compat provider（fake）、provider 路由、key 缺失粘贴流、effort 仅 codex 覆盖

## 发布
self-merge 到 dev 后作为 **0.0.7**（发布动作由项目所有者执行）。
> 真实可调通性（DeepSeek/Kimi 需各自 key + 订阅）由 ByAnDa 实测确认。
