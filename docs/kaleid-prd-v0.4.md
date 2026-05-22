---
项目: kaleid（ByAnDa 自用 → 公开发布的终端编码 agent）
PM: kaleidLead（暂代 — kaleid 无独立 PM）
Reviewer: ByAnDa
上游流程文档: 《工程开发总流程 v1》cluster meta SOP；本 PRD 对应 stage 2 PRD。kaleid = CLI/工具型项目，仅终端 TUI、无 web/app 视觉设计 → stage 3 Claude Design skip。流程：PRD → spec(kaleidLead 自起) → 委派 Multica。
版本: v0.4（并入 V1 后的 spec-008~014 全部内容，PRD 升级为当前产品全貌）
生成时间: 2026-05-21 起草 / 2026-05-22 持续更新（kaleidLead）
代码地址: 本地 ~/repos/kaleid / GitHub https://github.com/ByAnDa/kaleid / npm 包 `kaleid`（已公开发布）
状态: V1（spec-001~007）已发布并迭代中；spec-008~014 见 §八
用途: kaleid 项目产品需求文档，spec 工作流的产品端输入源

变更日志:
- v0.4（2026-05-22，ByAnDa msg=e73fd79f）：把 V1 后已实施/在做的 spec-008~014 内容并入 PRD（slash 命令 / 全屏 TUI / 模型·推理选择器 / 多 provider / 对话记忆），PRD 升级为当前全貌。新增 §八 演进与 §九 多 provider；F-series 与版本路线更新。
- v0.3（2026-05-22）：V1 定稿。provider 锁 OpenAI Codex OAuth + gpt-5.5；D1-D5 + Q1/Q2 锁定。
- v0.2（2026-05-21~22）：路线 (a) clean-room / TUI ink / 与 Architect 无关 / Q1Q2 / provider 改 Codex OAuth。
- v0.1（2026-05-21）：初稿。
---

# kaleid PRD v0.4 — 终端编码 Agent（当前全貌）

> **本文档作用**：把 ByAnDa 的"自用 harness agent"想法落成可被 spec 工作流消费的需求文档，并随迭代保持为当前产品全貌。
> **路线（已定）**：(a) **clean-room 自研** —— 依 pi 架构与 Claude Code 经验从零实现，**借鉴设计模式但不依赖/复制其代码**。
> **演进策略**：V1 做扎实最小内核（spec-001~007），之后每个增量一个 spec（spec-008+）顺序迭代发布（npm 0.0.x）。

---

## ⭐ 重点借鉴项目（架构/经验参考，clean-room 不复制代码）
1. **pi** — https://github.com/earendil-works/pi （MIT 开源）：agent harness 4 包 monorepo（pi-ai 多 provider+OAuth / pi-agent-core loop+工具+状态+compaction / pi-coding-agent / pi-tui）。OAuth / Responses / 工具 / loop / 压缩 的 wire 与设计参考。
2. **Claude Code**（Anthropic 终端编码 agent）：架构模式灵感（Tool 接口分层 / bash 安全分层 / Ink 渲染防闪 / 两级 compaction）。不引用其代码或来源。
> 📌 standing rule：每次发 kaleid Multica issue，正文都放这两个参考仓库 URL（CC 链接不进公开 repo，仅本地 vault）。

---

## 一、产品定位

### 1.1 一句话定位
> kaleid 是一个**终端编码 Agent（harness）**：多 provider 接入 LLM（OpenAI Codex OAuth / DeepSeek / Kimi，可扩展），具备 read/write/edit/bash 工具与 agent loop，运行在**全屏 ink TUI**（顶部 header / 中部对话区 / 底部固定输入 + slash 命令 + 模型·推理选择器 + 上下文用量显示），带**对话记忆（自动压缩 + 持久化/resume）**，打包为 npm CLI 公开发布。

### 1.2 设计理念
- 自用起步 → 已公开发布（npm `kaleid`，UNLICENSED）。
- 最小内核 + 增量演进：V1 内核扎实，关键扩展点（provider 抽象 / bash chokepoint / loop 输入源抽象 / Tool 接口 / session+compaction 预留）就位，后续 0 重构挂上。
- clean-room：借鉴 pi/Claude Code 设计模式，自写实现。

---

## 二、核心范围（V1，spec-001~007，已发布 0.0.1）

| # | 能力 | 说明 |
|---|---|---|
| F1 | **AI provider 接入** | `LLMProvider` 薄抽象；V1 首发 = OpenAI Codex OAuth（ChatGPT 订阅，默认 gpt-5.5）|
| F2 | **4 个核心工具** | read / write / edit / bash，统一 `Tool` 接口；bash 走单一 `executeBash()` chokepoint |
| F3 | **agent loop** | mode-agnostic tool-use 循环；预留 compaction/session 钩子 |
| F4 | **交互模式** | REPL + one-shot，共用同一 loop |
| F5 | **TUI** | ink 实现（V1 简单版 → 见 §八已升级为全屏）|
| F6 | **npm 打包** | esbuild 单文件 + bin=kaleid，公开发布 npm |

详见 §三（F1-F6 详述）+ `specs/kaleid-v1-spec.md`。

---

## 三、V1 功能详述（F1-F6）

### F1 — Provider（OpenAI Codex OAuth）
- `LLMProvider` interface（chat(messages,tools)→{text,toolCalls} + stream）；首发实现 `OpenAICodexProvider`。
- OAuth：PKCE(S256) → 浏览器 `auth.openai.com/oauth/authorize`（Codex client_id）→ 本地 :1455 回调换 access/refresh/expires → 解 JWT 取 chatgpt_account_id；兜底手动粘贴。
- 调用：`https://chatgpt.com/backend-api/codex/responses`，Responses API，Bearer + chatgpt-account-id。到期自动 refresh。
- 凭证存 `~/.kaleid/auth.json`（600）。默认模型 gpt-5.5。

### F2 — 工具（统一 Tool 接口）
- `Tool`：name + zod schema + isReadOnly + activity(spinner 文案) + execute。
- read（行号/截断 2000 行·50KB）/ write（建父目录）/ edit（old_string 唯一匹配）/ bash（经 executeBash chokepoint：超时杀进程组、输出截断）。

### F3 — Agent Loop
- user→LLM(带工具)→执行 toolCalls 回灌→循环至无 tool_call；多步上限防失控；工具错误回灌纠错；mode-agnostic。

### F4 — 交互模式
- REPL（带 TUI）/ one-shot（stdout 流式）。system prompt 固定内置编码助手 prompt（不提供 --system-prompt 覆盖）。

### F5 / F6 — TUI / 打包
- 见 §八（TUI 已升级全屏）；打包 esbuild 单文件、npm 公开发布。

---

## 四、技术决策（已锁定）
| # | 决策 | 结论 |
|---|---|---|
| D1 | Provider | `LLMProvider` 薄抽象；多 provider（见 §九）；默认 gpt-5.5 |
| D2 | 语言/runtime | TypeScript + Node v24（ESM）|
| D3 | 交互模式 | REPL + one-shot 共用 loop |
| D4 | bash | 直接执行 + 单一 `executeBash()` chokepoint |
| D5 | TUI | ink（+ 自研 TTY diff renderer 防闪，见 §八）|
| Q1 | 持久化 | OAuth 凭证 + provider key 持久化（~/.kaleid/auth.json·config.json）；会话持久化见 spec-014 |
| Q2 | system prompt | 固定内置编码助手 prompt，不提供覆盖 |
| - | LICENSE | 不发 LICENSE 文件，package.json `"license":"UNLICENSED"`（保留所有权利）|

---

## 五、成功标准 / DoD（V1）
1. `kaleid login` 后能跑通真实编码任务（读/改/跑测试），凭证持久化+自动刷新。
2. read/write/edit/bash 经统一 Tool 接口被 LLM 正确调用回灌；bash 全经 chokepoint。
3. REPL（ink 无闪）+ one-shot 可用。
4. `npm i -g kaleid` 可运行。
5. 扩展点（provider/chokepoint/Tool 接口/loop 输入源/session+compaction）就位。

---

## 六、风险 / 待确认
- 真实后端可调通性：Codex/DeepSeek/Kimi 的真实订阅/key 可用性需 ByAnDa 实测，按实际裁剪模型常量。
- ToS：OpenAI Codex OAuth（ChatGPT 订阅）属灰色地带；Anthropic 已明确禁止第三方用 Claude 订阅 OAuth（故 Claude 只能走 API key，见 §九）。
- 委派：走 Multica（Mode A），kaleid squad 实施。

---

## 七、里程碑 / 版本路线（实际）
| 版本 | 内容 | spec |
|---|---|---|
| **0.0.1** | V1 内核：Codex OAuth + 4 工具 + loop + REPL/one-shot + 简单 TUI + npm | 001~007 |
| 0.0.2 | login/logout/exit 改 REPL slash 命令 + 补全菜单 | 008 |
| 0.0.3 | 修 `/login` 在 TUI 下无反馈（OAuth 回调式接 TUI）| 009 |
| 0.0.4 | **全屏 TUI**（header/对话区/固定输入 + 消息区分 + 自研 diff renderer 防闪）| 010 |
| 0.0.5 | `/model` 模型选择器 + `/reasoning` 推理强度 + header 显示 | 011 |
| 0.0.6 | 模型清单对齐 pi + `/model` 选完链式选 effort | 012 |
| 0.0.7 | **多 provider**：DeepSeek + Kimi + `/login` provider 选择器 | 013 |
| 0.0.8 | **对话记忆**：token 显示 + 自动压缩 + /compact + 持久化/resume | 014 |
| 0.0.9 | bugfix 批：DeepSeek reasoning_content / Codex system 消息 / slash 双回车 | 015 |
| 0.0.10 | `/rename` 对话命名 + 项目/对话两级 + 输入框右上角常显 | 016（BYW-112）|
| 下一版 | `/project` 改项目 + `/chatlabel` 多标签 + 右上角合并显示 | 017（待审核）|
| 远期 | tmux 全 pane context / Slack bot / bash sandbox / 富 TUI / skills | - |
> 注：0.0.7~0.0.10 在 dev 累积，由 ByAnDa 实测后统一发布。

---

## 八、V1 后演进（spec-008~014，并入本 PRD）

### spec-023 — TUI 二轮精修（待审核）
- 4 项（原第 5 项"鼠标滚轮翻动"经 ByAnDa msg=f25ed83f 去掉）：①底部状态信息行**右对齐**（仍单行不换行、对话名 `…` 截断）；②thinking/忙碌指示**独占一行**，不与状态信息同行；③对话区与底部状态行之间留白（约 1 空行）；④启动欢迎区**恢复上一版带 ◆◇◆ logo 的 banner 设计**（仍作对话首条随上滚消失，不回固定 Header）。详见 `kaleid spec-023 tui-statusline-and-scroll.md`。

### spec-008 — REPL slash 命令（0.0.2，已发）
- `/login` `/logout` `/exit` `/help`；输入 `/` 开头=命令否则 prompt；slash 在 TUI 内处理不发 LLM。
- **移除顶层 CLI `kaleid login`/`logout`**。
- slash 补全菜单：输入 `/` 列全部命令、前缀实时筛选、方向键/Enter/Tab/Esc。

### spec-009 — `/login` TUI 修复（0.0.3，已发）
- OAuth login 加 onAuthUrl/onStatus/getManualCode 回调；TUI 始终显示授权 URL（可手动复制）+ 粘贴 code 入口 + 登录成功提示。CLI 路径不回归。

### spec-010 — 全屏 TUI（0.0.4，已发）
- 全屏三段式：顶部圆角 `kaleid` header / 中部自动贴底对话区 / 底部固定输入框。
- 消息四类区分：you(绿)/kaleid(青)/tool(紫)/system(灰)/error(红)。
- **自研 TTY diff renderer**（`src/tui/terminal.ts`）：拦截 ink 整屏 clear、只 patch 变化行 + alt-screen → 无闪。后续全屏类改动都靠它防闪。

### spec-011 — 模型 / 推理选择器（0.0.5，已发）
- `/model` 选择器（列模型/标当前/箭头高亮/回车应用/Esc）；`/reasoning` 推理强度（minimal/low/medium/high/xhigh，默认 medium，写 reasoning.effort）。
- header 右上角常显 `model · effort`。数据单一来源 `src/provider/models.ts`。

### spec-012 — 模型清单对齐 pi + 链式 effort（0.0.6，已发）
- AVAILABLE_MODELS 对齐 pi `[openai-codex]`：o4-mini-deep-research / gpt-5.2 / gpt-5.3-codex / gpt-5.3-codex-spark / gpt-5.4 / gpt-5.4-mini / gpt-5.5(默认)。
- `/model` 选完模型链式弹 effort 选择器。

### spec-013 — 多 provider：DeepSeek + Kimi（0.0.7，进行中 BYW-109）
- 见 §九。`/login` 改 3 选项 provider 选择器；`/model` 只列已登录 provider 的模型。

### spec-015 — 0.0.8 实测 bugfix 批（0.0.9）
- ① DeepSeek `reasoning_content` 400：openai-compat 捕获 reasoning_content 并每条 assistant 回传（真值或 ""）。
- ② OpenAI Codex `System messages are not allowed` 400：Responses `input` 不含 system 角色（system 只走 instructions）；compaction 摘要改 user 角色。
- ③ slash 命令双回车：Enter 一次直接执行。

### spec-016 — `/rename` + 项目/对话两级（0.0.10，BYW-112）
- `/rename <名称>` 或 `/rename <项目>/<名称>`；会话两级 **项目 - 对话名称**（默认无项目）存 metadata；输入框右上角常显 `项目 - 名称`；resume 列表用 项目-名称 显示。

### spec-017 — `/project` + `/chatlabel` 多标签（待审核）
- `/project <名称>` 改/清当前对话 project；`/chatlabel <标签>` 加多标签（去重、可移除）；右上角合并常显 `项目 - 名称 + #标签`。`/project` //chatlabel 为 combobox（选现有 distinct 或直接输入新的）。详见 `kaleid spec-017 project-and-labels.md`。

### spec-018 — resume project/label 筛选（待审核）
- resume 选择器顶部加筛选栏 project（默认全部）+ label（默认全部）；选中进入对应列表选一个后返回、只显示该 project/label 的对话；两维 AND；选"全部"清除。详见 `kaleid spec-018 resume-filter.md`。

### spec-022 — TUI 布局精修（待审核）
- 对当前全屏 TUI 的 6 项布局/视觉精修（**不改功能**）：①对话区从屏幕最顶端开始（去固定 Header），欢迎/介绍作对话首条随上滚消失，类似 Claude Code；②左侧角色 gutter 改单列最细竖线 `▏`（两主题统一，弃 2 字宽实心块）；③相邻消息之间空 1 行（终端最小可行间隔）；④色条每条一整条连续、空行不画色条、消除叠块/错位；⑤底部输入框多行时整框增高、边框闭合、下方无缺口；⑥对话名·项目·label·model·effort 移到底部输入框上沿一行，强制单行不换行，超长在对话名末尾用 `…` 截断。详见 `kaleid spec-022 tui-layout-polish.md`。

### spec-021 — 应用真实设计配色 + 像素贴合（已完成，待发 0.0.12）
- 修 spec-020 占位色：用 `design/kaleid/project/kaleid-tokens.js` 精确 token 逐值替换 daylight/spectrum + 按 screenshots 像素贴合（WelcomeBanner / ResumeScreen filter chips·grid / chat 正文走主题色、role 色仅 gutter·label）。设计 bundle 已 commit 到 repo `design/kaleid/`（排除私有 uploads）。详见 `kaleid spec-021 apply-real-design-colors.md`。

### spec-020 — 设计重构 + Daylight/Spectrum 双主题 + token 系统 + 多行输入（已完成，待发 0.0.12）
- 按 Claude Design bundle 重做全屏 TUI：移植语义 token（surface/text/border/accent/role/status/tag/project）；双主题 Daylight(浅)/Spectrum(深)，**默认跟随终端**；**truecolor + 256/16 降级 fallback**；角色 gutter 色条 + 前缀 + tag/project 色块徽章；多行输入；`/theme` 切换；不实现 OS 窗口 chrome。设计 bundle 经 URL fetch（spec-021 起改 commit 到 repo `design/kaleid/`）。详见 `kaleid spec-020 design-restyle-themes.md`。

### spec-019 — 命令无参进入交互输入（待审核）
- `/rename` 无参时进入交互输入态（预填当前名、可 项目/名称），不只靠后置参数；/project //chatlabel 已是 combobox（无参进交互）。三命令一致：无参进交互、带参直接设。详见 `kaleid spec-019 command-interactive-input.md`。

### spec-014 — 单对话记忆（0.0.8）
- **token 常显输入框下方**：`ctx used / window · pct%`（当前上下文 / 最大窗口 / 百分比），接近上限变色。
- **自动压缩**（pi 式）：token > 窗口 - reserve → LLM 总结旧历史、保留最近 ~keepRecent，replace 为摘要。
- **`/compact`** 手动命令。
- **持久化 + resume**：会话存 `~/.kaleid/sessions/<id>.jsonl`；`--continue`/`--resume`/`/resume` 恢复。
- 填 spec-005 预留的 session.maybeCompact()/persist() 钩子。每模型 contextWindow 配在 models.ts。

---

## 九、多 provider（spec-013+）

| provider | 接入 | baseURL | 模型 | effort |
|---|---|---|---|---|
| **OpenAI Codex** | OAuth（ChatGPT 订阅）| chatgpt.com/backend-api/codex/responses | 见 spec-012 列表（gpt-5.x [openai-codex]）| ✅ reasoning.effort |
| **DeepSeek** | API key（Bearer，粘贴存 config）| https://api.deepseek.com | **动态 GET /models**（fallback deepseek-v4-pro/flash；deepseek-reasoner 做推理）| ❌（用 reasoner 模型，无 effort 等级）|
| **Kimi coding** | API key | https://api.kimi.com/coding/v1 | 单一 `kimi-for-coding` | ❌ |
| Claude（若加）| **只能 API key**（Anthropic Messages API）| api.anthropic.com | - | - |

- `/login` = provider 登录选择器（3 选项：Codex OAuth / DeepSeek 粘贴 key / Kimi 粘贴 key）；key 存 `~/.kaleid/config.json`（600）/ 兼容 env。
- `/model` 只列**已登录 provider** 的模型（带标签），loop 按所选模型 provider 路由（codex-oauth / openai-compat）。
- 通用 OpenAI 兼容 provider（`openai-compat.ts`）覆盖 DeepSeek/Kimi（原生 fetch+SSE 自写）。
- **认证政策红线**：Anthropic 明确禁止第三方产品用 Claude 订阅 OAuth（违反 Consumer ToS，已封 + legal request）→ Claude 只能走官方 API key。OpenAI Codex OAuth 同属灰色地带（OpenAI 暂未公开重拳，ByAnDa 知情接受）。

---

## 维护者
- 起草 / 暂代 PM / Spec owner：@kaleidLead　- 拍板：@ByAnDa
