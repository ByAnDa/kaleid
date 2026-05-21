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

### 2. provider 注册 + 模型清单（各 provider 来源不同）
- 每个模型项带 `provider` 字段。三类 provider 的模型来源**不一样**：
  - **openai-codex**：无实时 list 接口 → 用 spec-012 的 bundled 清单（对齐 pi）。
  - **deepseek**：✅ **OpenAI 兼容，有实时 `GET https://api.deepseek.com/models`**（Bearer key）→ **动态拉取可用模型**（如 deepseek-v4-flash / deepseek-v4-pro / deepseek-reasoner …），不硬编；拉取失败 fallback 到已知常量（deepseek-v4-pro / deepseek-v4-flash）。
  - **kimi**（coding plan）：基本是**单一固定模型 `kimi-for-coding`**（官方统一 id，后端自动选最新）→ 列表就这一个（可选也尝试 /models，但通常就 kimi-for-coding）。
- 选择器列表项显示 provider 标签（`gpt-5.5 [openai-codex]` / `deepseek-v4-pro [deepseek]` / `kimi-for-coding [kimi]`）。
- DEFAULT 仍 `gpt-5.5`（openai-codex）。
- **effort/reasoning**（回答 ByAnDa）：只有 **openai-codex** 有 reasoning_effort（low/med/high/xhigh）→ 才走 effort 链式。**DeepSeek 用单独的 `deepseek-reasoner` 模型做推理（无 effort 等级，深度靠 max_tokens）；Kimi 无 effort 参数** → 这两个 provider **跳过 effort 选择**（选完模型直接用）。

### 3. `/login` 改为 provider 登录选择器（3 选项，ByAnDa msg=56e4a227）
- `/login` 不再直接走 OAuth，而是**弹出 provider 选择器**，共 **3 个选项**：
  1. **OpenAI Codex**（OAuth）→ 走现有 spec-002/009 的浏览器 OAuth + 凭证存 `~/.kaleid/auth.json`。
  2. **DeepSeek**（API key）→ **粘贴 key 输入框**（复用 spec-009 粘贴模式）→ 保存到 `~/.kaleid/config.json`。
  3. **Kimi coding**（API key）→ 同上粘贴保存。
- 选择器交互同 OptionSelector（上下高亮、回车、Esc）。
- 登录成功后提示 `已登录: <provider>`。

### 4. 登录态 → /model 只显示已登录 provider 的模型（ByAnDa："登录上哪个就显示哪个的模型"）
- 维护登录态：哪些 provider 已认证（codex 有 OAuth creds / deepseek·kimi 有 key）。
- `/model` 列表**只列已登录 provider 的模型**（带标签）。未登录任何 provider → 提示先 `/login`。
- 登录了多个 provider → /model 显示这些 provider 的全部模型；选哪个=定 provider，loop 按 provider 路由（codex-oauth / openai-compat）。
- effort 链式（spec-012）：**仅 openai-codex** 接着弹 effort；DeepSeek/Kimi 跳过（提示 N/A）。

### 4b. API key 存储（DeepSeek / Kimi）
- 通过 `/login` 选 provider 后**粘贴保存**（ByAnDa 指定方式）：写 `~/.kaleid/config.json`（权限 600，按 provider 存 `{ deepseek: {apiKey}, kimi: {apiKey} }`）。
- 也兼容环境变量 `DEEPSEEK_API_KEY` / `KIMI_API_KEY`（有则视为已登录该 provider，可不必再 /login 粘贴）。
- key 仅存本地；不打印、不上报。`/logout` 可清除（按 provider 或全部，简单处理）。

### 5. header
- 右上角仍 `model · effort`；effort 对非 codex 可显示 `-` 或省略。可附 provider 标签（可选）。

## 验收标准
1. WHEN `/login` THEN 弹出 provider 选择器，3 个选项：OpenAI Codex / DeepSeek / Kimi coding。
2. WHEN 选 OpenAI Codex THEN 走现有 OAuth（spec-002/009）登录成功。
3. WHEN 选 DeepSeek 或 Kimi THEN 弹粘贴框输入 API key，保存到 ~/.kaleid/config.json（600），提示已登录该 provider。
4. WHEN `/model` THEN **只列已登录 provider 的模型**（带 provider 标签）；未登录任何 → 提示先 /login。
5. WHEN 选中某 provider 的模型并对话 THEN loop 按该 provider 路由：codex 走 OAuth+codex/responses；deepseek/kimi 走对应 baseURL 的 /chat/completions（流式 + 工具调用回灌）。
6. WHEN 选 openai-codex 模型 THEN 接着弹 effort（spec-012）；WHEN 选 deepseek/kimi THEN 跳过 effort（提示 N/A）。
7. WHEN 环境变量已设 DEEPSEEK_API_KEY/KIMI_API_KEY THEN 视为已登录该 provider（其模型出现在 /model）。
8. WHEN 切换 provider/model THEN header 实时反映。
9. clean-room；测试用 fake（各 provider 的 SSE/HTTP 全 mock，不连真实后端、不烧任何额度/key）；typecheck/test/build/pack 全绿；pack 仍 3 文件。

## 涉及文件（修改/新增）
- `src/provider/openai-compat.ts`（新建）— 通用 OpenAI 兼容 provider（DeepSeek/Kimi 共用）
- `src/provider/models.ts` — 加 deepseek/kimi 模型条目 + provider 字段/标签
- `src/provider/index.ts` 或路由 — 按当前模型 provider 选 impl（codex-oauth / openai-compat）
- `src/auth/config-store.ts`（新建，建议）— ~/.kaleid/config.json 存各 provider api key + 登录态查询
- `src/tui/app.tsx` / `commands.ts` — `/login` provider 选择器（3 选项）+ codex OAuth / deepseek·kimi 粘贴存 key；`/model` 仅列已登录 provider；effort 仅 codex
- `src/loop/*` — runTurn 按当前模型 provider 路由
- `test/` — /login 三选项流（OAuth / 粘贴 key）、登录态过滤 /model、openai-compat provider（fake）、provider 路由、effort 仅 codex 覆盖

## 发布
self-merge 到 dev 后作为 **0.0.7**（发布动作由项目所有者执行）。
> 真实可调通性（DeepSeek/Kimi 需各自 key + 订阅）由 ByAnDa 实测确认。
