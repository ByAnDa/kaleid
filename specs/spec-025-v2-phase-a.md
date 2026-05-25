---
项目: kaleid
文档: spec-025 — v2 设计 Phase A（状态 pill / 输入框强化 / resume 筛选对齐+修塌缩 bug / tool 折叠卡 / resume 预览侧栏只读）
作者: kaleidLead
生成时间: 2026-05-26
Reviewer: ByAnDa
上游: spec-020~024（都在 dev，已发 0.0.15）/ Claude Design v2 bundle（已 commit 到 repo design/kaleid/）
状态: **待 ByAnDa 审核（审核通过后才派 Multica）**
编号: spec-025
依赖: spec-024（已在 dev）
类型: TUI 视觉/布局（v2 Phase A，纯视觉 + 真实数据驱动，不引入新 backend 能力）
---

# spec-025 — v2 设计 Phase A

> 触发：ByAnDa 提供 v2 大改版设计（调研 Claude Code/Codex/Crush 后重做），msg=4d57a4e5 拍板「先做 Phase A」。Phase A = **能被现有数据驱动的纯视觉/布局**部分；依赖新 backend 能力的（plan/approval/autonomy 模式、reasoning 流、@附件、fork、全文搜索、subagent）= Phase B，本 spec 不做。

## 设计来源（已在 repo，直接读，勿 fetch URL）
- **`design/kaleid/project/kaleid-tokens.js`** — token 单一来源（v2 新增 `state` 8 态 + `mode` 4 模式调色板；Daylight=modes.light / Spectrum=modes.dark）。
- **`design/kaleid/project/tui-screens.jsx`** — v2 各屏/组件布局（StateChip / InputComposer / ToolCard / ThinkingBlock / ResumeScreen+preview 等）。
- **`design/kaleid/project/screenshots/`** — 视觉目标（kaleid-final / 01-v2-multi / 02-v2-multi / v2-streaming / v2-chats / v2-overview）。
- **`design/kaleid/chats/chat1.md`** — 意图。
- 注：`uploads/`（ByAnDa 私图）已排除，**勿参考、勿 fetch URL**。

## ⚠️ Phase A 红线（重要）
**只做能被现有数据驱动的视觉/布局**。设计里属于新功能的元素，本 spec **不实现、也不显示假 UI**（避免空壳误导）：
- ❌ PLAN/AUTO/READ-ONLY 模式 pill、approval 审批卡、thinking block（reasoning 流）、@files 附件、plan card、subagent、会话 fork、全文搜索、date 筛选 —— 全部 Phase B。
- 一切交互**全键盘**（不引入鼠标，延续既定决策）。

## 变更详述（5 项）

### 1. 状态 pill（StateChip）
- 主对话界面显示当前**状态 pill**（色块 bg+fg+dot，取 token `state` 调色板）。
- **只映射现有真实状态**：`idle`（空闲）/ `thinking`（等首 token，现有 status="thinking..."）/ `streaming`（流式输出中）/ `running`（执行工具中）/ `ok`（完成）/ `err`（错误/中断）。`typing` 可选（用户输入中）。
- **不做** `awaiting-approval`（Phase B）。
- dot：**防闪优先**——Phase A 用静态彩色 dot（不做脉冲动画，或仅极低频；避免 diff renderer 频繁重绘 / CPU）。

### 2. 输入框强化（InputComposer）
- 多行输入框：border 卡片（沿用 single border）+ 左侧 prompt sigil（`›`）+ **行号**（多行时每行左侧显示行号，对照设计）。
- 底部 **hint bar**：**只显示已实现功能**的键提示 —— `Enter send` · `Ctrl+J newline`（现有）· `/ commands`（现有 slash）· `/model`（现有）。**不显示 `@ files` / `⌃P plan`**（Phase B 未实现，显示=误导）。
- 终端无 box-shadow → 设计的 "accent shadow" 用 focused 时**边框/accent 色**强调替代。
- 保留 spec-024 的右对齐状态行（对话名·项目·label·model·effort）+ token 行；与 hint bar 协调排布、不重复、不破整框。

### 3. resume 筛选栏对齐设计 + 修塌缩 bug（关键）
- **修 bug（已 root-caused）**：当前筛选栏行 `height={1} overflow="hidden"`，内容（`resume session │ project[chips] │ label[chips]`）在终端宽度下排不进 1 行时**整行塌缩/空白消失**（我用 ink-testing-library 复现：width≤~62、或 project/label chips 多到超宽时触发 → 用户「筛选没了」）。**修复**：筛选栏内容必须**按宽度预算自适应**（chip 数 + 标签按可用宽度截断，放不下用 `+N`/省略），**绝不允许整行塌缩**；窄终端也要至少显示 `project`/`label` 组标签且可聚焦。
- **对齐 v2 目标样式**：参照 `screenshots/kaleid-final.png` + `01-v2-multi.png` 的筛选栏排布（project/label chips、当前项高亮）。
- 保留 spec-018 行为：Tab/←/→ 聚焦 sessions↔project↔label、Enter 进入选择、按 project/label 过滤列表、选「全部」清除。
- model 筛选：**可选**加（我们有 model 信息，低成本）；**date 筛选 / 全文搜索 = Phase B，不做**。

### 4. tool call 折叠卡片（ToolCard）
- tool call 渲染成**卡片**：默认**折叠** = 一行 `▸ name(args) ✓/✗ <result 摘要>` + `⏎ to expand` 提示；展开（`▾`）显示完整输出/diff panel（用 token role.tool 色 + status pill ok/err）。
- **全键盘**：需要「当前可聚焦的 tool 项 + 折叠状态」——选中后 Enter/Space 展开/折叠。具体聚焦交互对照设计、squad 定细节（不引鼠标）。
- 与普通文本输出视觉区分（现有 role.tool 色 + gutter 延续）。

### 5. resume 预览侧栏（只读）
- resume 屏右侧加 **preview pane**：显示**当前选中会话**的：最后一条回复（读该会话 jsonl 最后一条 assistant 消息，截断）+ meta（model / messages 数 / context tokens / 最近活跃时间）。
- **Phase A 只读**：**不含 fork/delete 按钮**（fork=Phase B 需会话分叉；delete 留 Phase B）；resume（恢复）动作沿用现有（选中 Enter）。
- 我们**不跟踪** cost($) / git branch → Phase A **省略**这两项（不显假数据）。
- **响应式**：列数不足的窄终端**隐藏 preview pane**（只显列表，避免挤压）；足够宽时才显示。对照 `01-v2-multi.png` 的列表+右侧 pane 布局。

## 验收标准
1. WHEN 对话各状态 THEN 顶部状态 pill 正确反映 idle/thinking/streaming/running/ok/err（色+dot，取 state token）；无脉冲动画导致的闪烁。
2. WHEN 多行输入 THEN border 卡片 + prompt sigil + 行号；hint bar 只列已实现键（Enter/Ctrl+J//commands//model），不含 @files/plan。
3. WHEN 打开 resume 且 project/label 较多或终端较窄 THEN 筛选栏**不塌缩**、按宽度自适应（截断/`+N`）、可聚焦可过滤（spec-018 行为保留）；样式对齐设计。
4. WHEN tool call THEN 默认折叠卡片（`▸ name ✓ 摘要` + ⏎ to expand），键盘可展开/折叠（`▾` 显示完整输出），与普通输出区分。
5. WHEN resume 选中某会话且终端够宽 THEN 右侧 preview pane 显示最后回复 + 真实 meta（model/msgs/context/活跃时间）；窄终端隐藏 pane；无 fork/delete/cost/branch 假数据。
6. spec-020~024 全部功能与配色不回归；Phase B 元素一律不出现（无 plan/approval/@files/reasoning 空壳）。
7. 防闪沿用 spec-010 diff renderer；clean-room（按设计还原不抄 HTML）；测试用 fake；typecheck/test/build/pack 全绿；pack 仍 3 文件（README + dist/index.js + package.json）。

## 涉及文件（修改/新增）
- `src/tui/theme/{tokens.ts,daylight.ts,spectrum.ts}` — 加 `state`/`mode` 调色板（mode 先只入 token，UI Phase B 用）。
- `src/tui/components/StateChip.tsx`（新）+ `app.tsx` — 状态 pill，映射现有 busy/status/streaming。
- `src/tui/components/InputBar.tsx` / `MultilineInput.tsx` — 行号 + hint bar（只列已实现）+ focused 强调。
- `src/tui/components/ResumeSelector.tsx` + `app.tsx` — 筛选栏自适应（修塌缩）+ 对齐样式 + 预览侧栏（只读，响应式）+ 读 session 最后回复。
- `src/tui/components/ToolCall.tsx` → 折叠卡片 + 折叠状态/聚焦。
- `src/loop/session-store.ts`（或读取层）— 提供「会话最后回复 + meta」给预览 pane（如尚无）。
- `test/` — 状态 pill 映射、hint bar 内容、筛选栏自适应不塌缩（含窄宽/多 chip）、tool 折叠/展开、预览 pane 内容+响应式隐藏、不回归 覆盖。

## 规范（per ByAnDa，必带）
- 开发分支 `feature/spec-025-v2-phase-a`（从 `dev` 切）→ 自测/CI → **self-merge 回 `dev`**。禁用 `agent/<role>/<hash>` 名。
- **只做实施；禁止 publish/tag/release/version bump**（发布与版本由 owner）。
- clean-room；测试用 fake；`npm pack` 仍只 README + dist/index.js + package.json。

## 发布
self-merge 到 dev 后由 owner 发布（下一个小版本 0.0.16）。体量较大，squad 可内部分片：状态 pill / 输入框 / resume(筛选+预览) / tool 折叠卡。
