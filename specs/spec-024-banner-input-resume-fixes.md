---
项目: kaleid
文档: spec-024 — TUI 第三轮修复（logo banner 双色还原 / 输入框右边距对齐+背景填满 / 修复 resume 的 project·label 筛选）
作者: kaleidLead
生成时间: 2026-05-23
Reviewer: ByAnDa
上游: spec-020~023（都在 dev / 已发 0.0.14）
状态: **待 ByAnDa 审核（审核通过后才派 Multica）**
编号: spec-024
依赖: spec-023（已在 dev）
类型: TUI 修复（bugfix + 视觉还原）
---

# spec-024 — TUI 第三轮修复

> 触发：ByAnDa msg=e4f60c6f（附 2 张截图）。3 个问题：①spec-023 的 logo banner 没真正还原双色；②输入框右边距/对齐 + 背景没填满；③resume 的 project/label 筛选用户反馈"没了"（回归）。

## 设计来源（配色/视觉对照，已在 repo）
- `design/kaleid/project/kaleid-tokens.js`（token）、`tui-screens.jsx`（布局）、`screenshots/`（视觉）。直接读 repo，勿 fetch URL。

## 变更详述（3 项）

### 1. logo banner 双色还原（修 spec-023 遗留）
- 现状：spec-023 把欢迎区 logo 作为 `role:"system"` **纯文本**（`buildWelcomeIntroText` 前缀 LOGO_LINES）注入对话，渲染走 system **单色暗**，丢了上一版 banner 的 **◆=accent(烧橙) / ◇=muted** 双色。
- 改为**真正的彩色 banner**：把 `Header.tsx` 现有的 `LogoLine`（逐字上色：◆→`theme.accent.default`、◇→`theme.text.muted`）整理成**可复用组件 `WelcomeBanner`**（logo + `kaleid vX.Y.Z` + model·provider·effort + tips），作为对话**首条**以**特殊条目**渲染（**不走普通 system message 的单色文本路径**）。
- **保留 spec-022 置顶逻辑**：banner 是对话首条、随对话上滚消失，**不回固定顶部 Header 带**。
- 视觉对照 `design/kaleid/project/`（screenshots / tui-screens.jsx）。

### 2. 输入框右边距 + 对齐 + 背景填满（见截图 `/tmp/kaleid-shot-2.png`）
- **(a) 右边距 + 对齐**：顶部状态行（右对齐的 对话名·项目·label·model·effort）与底部 footer 行（token 状态 + `Enter send · Ctrl+J newline` 提示）都要**与右边框留一点点空隙**（统一右边距，如 1 格），且两行**右对齐到同一右边界**（当前两者右侧空隙不一致/未对齐）。
- **(b) 背景填满**：输入框内部背景色块（`theme.surface.canvas` 底色）当前**没有铺到框的右边缘**——右侧残留一段纯黑（终端默认底色），要让 canvas 底色**填满到输入框右内沿**（包括空输入/内容不满一行时）。

### 3. 修复 resume 的 project·label 筛选（回归，见截图 `/tmp/kaleid-shot-1.png`）
- 用户反馈：resume 打开后 project/label **筛选功能"没了"**。
- 代码层排查：渲染（`ResumeSelector` 的 `FilterGroup`：`resume session │ project │ label` + chips）、键盘导航（`app.tsx` `resumeFocus` 的 Tab/←/→/↑↓ 切换 sessions↔project↔label，约 1239-1269 行）、Enter 进入筛选 + 应用筛选 —— **代码均在**，spec-022/023 未删除（`ResumeSelector.tsx` 上次改动是 spec-021）。
- 故疑为**视觉/布局回归**：筛选栏行渲染为空/不可见，或无法聚焦到 project/label。squad **在真实终端复现**：打开 resume 看筛选栏是否显示、能否 Tab/箭头聚焦 project/label、能否过滤列表（spec-018 行为：选中 project/label 后列表只显示该筛选）。**修复使筛选栏正常显示且可用**，并补回归测试。

## 验收标准
1. WHEN 启动/新会话 THEN 欢迎区是**彩色** logo banner（◆ 烧橙 / ◇ muted，含版本+model+tips），作对话首条随上滚消失、不回固定 Header。
2. WHEN 渲染输入框区 THEN 顶部状态行与底部 footer 行均与右边框留统一小空隙且右对齐到同一边界；输入框 canvas 底色填满到右内沿、无纯黑残留。
3. WHEN 打开 resume THEN project/label 筛选栏显示且可用（Tab/箭头聚焦、Enter 进入选择、按 project/label 过滤列表、选"全部"清除），spec-018 行为恢复。
4. spec-020~023 其它功能与配色不回归（主题/降级/细线 gutter/消息间隔/对话置顶/状态行右对齐/thinking 独行/对话区留白/多行输入/slash/选择器/记忆/rename/project·label）。
5. 防闪沿用 spec-010 diff renderer；clean-room；测试用 fake；typecheck/test/build/pack 全绿；pack 仍 3 文件（README + dist/index.js + package.json）。

## 涉及文件（修改）
- `src/tui/components/Header.tsx` / 新 `WelcomeBanner.tsx` — 把 LogoLine 彩色 banner 整理成可复用组件。
- `src/tui/app.tsx` — intro 改用彩色 `WelcomeBanner` 作首条特殊条目（不走 system 纯文本）；conversation 渲染支持该特殊条目。
- `src/tui/components/Conversation.tsx` / `Message.tsx` — 支持渲染 banner 特殊首条（多色），不破坏置顶/间隔/gutter。
- `src/tui/components/InputBar.tsx` / `StatusLine.tsx` — 状态行 + footer 右边距统一 + 右对齐对齐；输入框 canvas 底色填满右内沿。
- `src/tui/components/ResumeSelector.tsx` + `src/tui/app.tsx` — 修复筛选栏可见性/可聚焦性（复现后定位）。
- `test/` — 彩色 banner 首条、输入框右边距/对齐/填满、resume 筛选可见+可用+过滤、不回归 覆盖。

## 规范（per ByAnDa，必带）
- 开发分支 `feature/spec-024-banner-input-resume-fixes`（从 `dev` 切）→ 自测/CI → **self-merge 回 `dev`**。禁用 `agent/<role>/<hash>` 名。
- **只做实施；禁止 publish/tag/release/version bump**（发布与版本由 owner）。
- clean-room；测试用 fake；`npm pack` 仍只 README + dist/index.js + package.json。

## 发布
self-merge 到 dev 后由 owner 发布（下一个小版本 0.0.15）。
