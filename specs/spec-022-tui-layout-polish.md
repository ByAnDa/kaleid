---
项目: kaleid
文档: spec-022 — TUI 布局精修（对话置顶 / 细线 gutter / 消息间隔 / 状态行下移 / 输入框整框 / 状态不换行）
作者: kaleidLead
生成时间: 2026-05-23
Reviewer: ByAnDa
上游: spec-020(双主题+token+多行输入) / spec-021(真实设计配色)
状态: **待 ByAnDa 审核（审核通过后才派 Multica）**
编号: spec-022
依赖: spec-020 + spec-021（都在 dev）
类型: TUI 布局/视觉精修（不改功能）
---

# spec-022 — TUI 布局精修

> 触发：ByAnDa msg=7612f3e0 + msg=02b0cfca（附截图 `/tmp/kaleid-tui-screenshot.png`，Spectrum 深色），对当前全屏 TUI 提了 6 项视觉/布局问题。msg=4be255c9 拍板状态行位置。本 spec **只调布局与视觉，不改任何功能**，spec-020/021 全部功能不回归。

## 背景（截图印证的问题）
当前全屏 TUI（顶 `Header` + `Conversation` + selectors + `InputBar`）存在：
- 顶部固定 `Header`（logo+版本+介绍+右上角 对话名·项目·label·model·effort）占了好几行，对话被下压。
- 左侧角色 gutter：Daylight=`▌`（半块）、Spectrum=`block`（2 字宽实心块）→ **太粗**；多行消息处色块还**错位叠成两块**。
- 消息之间**无间隔**（顶部几条挤在一起），布局不一致。
- 底部输入框（single border）随打字增高时**下方产生缺口/边框不闭合**。
- 右上角状态（对话名·项目·label）在窄终端会**换行**。

## 变更详述（6 项）

### 1. 对话区从屏幕最顶端开始（类似 Claude Code）
- **去掉顶部固定 `Header` 带**；对话内容区从第 0 行开始，占据从顶端到底部状态行/输入框之间的全部高度。
- 原 `Header` 里的**欢迎/介绍（logo + 版本 + tagline）改为对话的第一条内容**（一个 intro 条目，渲染在消息流最前），随对话增长自然上滚消失。
- 对话内容**顶部对齐**：消息少时从顶端开始往下排，空白留在底部（消息流与底部状态行之间）；消息多到超出高度时按现有逻辑滚动（最新贴近底部状态行）。
- 原 `Header` 的状态部分（对话名·项目·label·model·effort）→ 见第 6 项移到底部。

### 2. 左侧角色色条 = 最细竖线
- gutter 改为**单列最细竖线** `▏`（U+258F，LEFT ONE EIGHTH BLOCK），用角色色着色 + 一个空格分隔正文。
- **两个主题都用细线**；废弃 Spectrum 的 2 字宽 `block` 实心块（`gutterStyle` 统一为细线，或保留 token 但 Daylight/Spectrum 都解析为 `▏`）。
- 验收对照：截图里的粗块/2 字宽块不再出现。

### 3. 消息之间加间隔
- 相邻消息之间插入 **1 个空行**（终端字符格最小单位；ByAnDa 期望"约 1/4~1/5 行高"在终端无法渲染小于一行，1 空行为最接近的最小可行间隔，spec 内已说明此约束）。
- 间隔在**每两条消息之间**一致出现；消息流首条之前、末条之后不额外加。

### 4. 色条每条一整条连续、不叠块
- 每条消息左侧色条是**一整条连续竖线**（多行消息每一行都有该条、颜色一致、无错位）。
- **空行（第 3 项的间隔行）不画任何色条**（背景填 canvas）→ 相邻两条消息的色条之间被空行隔开，**彻底消除截图里"两块叠在一起/错位"**的现象。

### 5. 底部输入框保持完整框体（打字不留缺口）
- 输入框（single border）在多行增高时**整框一起增高**，边框四边始终闭合，**下方不产生缺口/notch**。
- 修正点：确保 bordered Box 的 `height` 与 `MultilineInput` 实际渲染行数一致（`getInputBarHeight` / box `height={inputRows+2}` 与 `getMultilineInputRows` 用**同一套行数计算**，避免估算不一致导致边框与内容错位）；token 行布局不变但不得侵入框体。

### 6. 状态行下移到输入框上沿 + 绝不换行
- 把 **对话名 · 项目 · label · model · effort** 合并到**底部输入框正上方的一行**（取代/扩展现有 `StatusLine`；现 `StatusLine` 仅显示忙碌 spinner，本 spec 让该行平时显示状态、忙碌时叠加 spinner）。
- 该行**强制单行、绝不换行**：用 token 色块展示 project/label 徽章 + model·effort；
- **空间不足时优先截断"对话名"**，在对话名末尾用 `…`（省略号）表示（复用/参考现有 `truncateConversationLabel`）；project/label/model/effort 尽量保留可见；
- 一行放不下时**硬裁到一行宽度**，绝对不允许折行到第二行。
- 原本塞在输入框内部右侧的 `conversationLabel` 改由这一状态行承载（避免重复显示）。

## 验收标准
1. WHEN 启动/对话 THEN 对话内容从屏幕最顶端开始（无固定 Header 带）；欢迎/介绍是对话首条、随上滚消失。
2. WHEN 渲染任意角色消息 THEN 左侧是单列最细竖线 `▏`（两主题一致），无 2 字宽实心块。
3. WHEN 连续多条消息 THEN 每两条之间有且仅有 1 个空行间隔。
4. WHEN 多行消息 / 相邻消息 THEN 每条色条为一整条连续竖线、空行处无色条、无叠块/错位。
5. WHEN 在输入框打字使其变多行 THEN 输入框整框增高、四边边框闭合、下方无缺口。
6. WHEN 终端足够宽 THEN 状态行（对话名·项目·label·model·effort）在输入框上沿单行完整显示；WHEN 终端较窄放不下 THEN 对话名末尾 `…` 截断、整行绝不换行。
7. spec-020/021 功能与配色不回归（主题/降级/多行输入/slash/选择器/combobox/记忆 token/rename/project·label/resume 筛选/真实设计 token 值）。
8. 防闪沿用 spec-010 diff renderer；clean-room；测试用 fake；typecheck/test/build/pack 全绿；pack 仍 3 文件（README + dist/index.js + package.json）。

## 涉及文件（修改）
- `src/tui/app.tsx` — 移除顶部 `Header` 带；conversationHeight 计算去掉 HEADER_HEIGHT、加入新状态行高度；把欢迎/介绍作为对话首条 intro 条目注入；状态信息下传到底部状态行。
- `src/tui/components/Header.tsx` — 拆分：欢迎/介绍部分 → 改为对话首条内容（可新建 `WelcomeIntro`/复用）；状态部分 → 并入底部状态行。Header 组件可能整体退场或仅留 intro。
- `src/tui/components/Conversation.tsx` — 顶部对齐（空白填到底部而非顶部）；entries 之间插入 1 空行间隔；行数估算（`estimateConversationEntryRows`/`getVisibleConversationEntries`）计入间隔行。
- `src/tui/components/RoleGutter.tsx` — 改为单列 `▏` 细线；空行不渲染色条。
- `src/tui/components/Message.tsx` — gutter 渲染配合（连续竖线、间隔行无 gutter）。
- `src/tui/theme/{tokens.ts,daylight.ts,spectrum.ts}` — `gutterStyle` 调整（两主题统一细线）。
- `src/tui/components/StatusLine.tsx` — 扩展为承载 对话名·项目·label·model·effort 的单行不换行状态行（含徽章 + `…` 截断 + spinner 叠加）。
- `src/tui/components/InputBar.tsx` — 移除框内 conversationLabel 重复显示；修正 box `height` 与多行行数一致（消缺口）；状态行接入。
- `test/` — gutter 细线/空行无色条、消息间隔行数、状态行不换行+`…`截断、输入框高度一致（无缺口）、对话置顶、不回归 覆盖。

## 规范（per ByAnDa，必带）
- 开发分支 `feature/spec-022-tui-layout-polish`（从 `dev` 切）→ 自测/CI → **self-merge 回 `dev`**。禁用 `agent/<role>/<hash>` 名。
- **只做实施；禁止 publish/tag/release/version bump**（发布与版本由 owner）。
- clean-room；测试用 fake；`npm pack` 仍只 README + dist/index.js + package.json。

## 发布
self-merge 到 dev 后由 owner 发布（0.0.xx，下一个小版本 0.0.13）。
