---
项目: kaleid
文档: spec-023 — TUI 二轮精修（状态行右对齐 / thinking 独占一行 / 对话区与状态行留白 / 启动 banner 恢复 logo 设计）
作者: kaleidLead
生成时间: 2026-05-23
Reviewer: ByAnDa
上游: spec-020(主题/token) / spec-021(真实配色) / spec-022(对话置顶+细线gutter+状态行下移)
状态: **待 ByAnDa 审核（审核通过后才派 Multica）**
编号: spec-023
依赖: spec-022（已在 dev）
类型: TUI 布局/视觉精修
---

# spec-023 — TUI 二轮精修

> 触发：ByAnDa msg=8900c7cb，对 spec-022 落地后的全屏 TUI 再提若干调整；msg=f25ed83f 去掉了"鼠标滚轮翻动"需求，本 spec 收敛为 4 项纯布局/视觉。

## 变更详述（4 项）

### 1. 底部状态信息行**靠右对齐**
- 输入框上沿的状态信息行（对话名 · 项目 · label · model · effort）由当前**左对齐**改为**右对齐**（填充移到行首，内容贴右）。
- 仍**强制单行不换行**、对话名超长 `…` 截断（spec-022 的 `buildStatusLineLayout` 截断逻辑保留，仅对齐方向变右）。

### 2. thinking（忙碌指示）**独占一行**，不与状态信息同行
- 当前 `StatusLine` 把 `busyStatus`（如 `thinking...` + spinner）和状态信息渲染在同一行；改为：
  - **状态信息行**：只显示 对话名·项目·label·model·effort（右对齐，见第 1 项），**不含** thinking。
  - **thinking 行**：模型进入 thinking/忙碌时，spinner + 文案**单独占一行**（建议位于状态信息行**上方**、对话区下方；空闲时该行不占位或为空）。
- 二者绝不在同一行。

### 3. 对话区与底部状态信息行之间**保留留白**
- 整个对话记录区域与下方状态信息行之间留**一定空间**（建议 1 个空行间隔），让对话内容不要紧贴状态行。
- 该留白计入高度预算（`conversationHeight` / `getInputBarHeight` 对应扣减），不破坏防闪与整框。

### 4. 启动时恢复**上一版本的 logo banner 设计**
- spec-022 把欢迎区改成了纯文本 3 行（`buildWelcomeIntroText`）；ByAnDa 要恢复**上一版本（spec-021）带 ◆◇◆ kaleidoscope logo 的 banner 设计**作为**刚进入时**的欢迎区。
- 实现：把注入对话首条的 intro 内容从纯文本改回**带 logo 的 banner**（复用 `Header.tsx` 里现有的 `LOGO_LINES` + 版本 + model + tips 排版；该组件目前是 dead code，正好复用为 intro 渲染）。
- **保留 spec-022 的对话置顶逻辑**：banner 作为对话首条内容，随对话上滚自然消失（**不是**回到固定顶部 Header 带）。

> 注：原第 5 项"鼠标滚轮翻动 scrollback"已被 ByAnDa（msg=f25ed83f）去掉，本 spec 不含滚动功能。

## 验收标准
1. WHEN 渲染底部状态行 THEN 内容右对齐、单行不换行、对话名超长 `…` 截断。
2. WHEN 模型 thinking/忙碌 THEN spinner+文案单独占一行、与状态信息行不在同一行；空闲时不串行。
3. WHEN 对话区渲染 THEN 对话内容与底部状态行之间有留白（约 1 空行），不紧贴。
4. WHEN 刚启动/新会话 THEN 欢迎区是带 ◆◇◆ logo 的 banner（复用上一版设计），且作为对话首条随上滚消失（不回固定 Header 带）。
5. spec-020/021/022 全部功能与配色不回归（主题/降级/细线 gutter/消息间隔/对话置顶/多行输入/slash/选择器/记忆/rename/project·label/resume 筛选）。
6. 防闪沿用 spec-010 diff renderer；clean-room；测试用 fake；typecheck/test/build/pack 全绿；pack 仍 3 文件（README + dist/index.js + package.json）。

## 涉及文件（修改/新增）
- `src/tui/components/StatusLine.tsx` — 右对齐；拆出 thinking 独立行（或新增 `BusyLine`）。
- `src/tui/components/InputBar.tsx` — 行序：[留白] [thinking 行(忙时)] [状态信息行右对齐] [输入框] [token 行]；高度计算同步。
- `src/tui/app.tsx` — intro 改用 logo banner 渲染；conversationHeight 计入留白。
- `src/tui/components/Header.tsx` — 复用 logo banner 排版作为 intro（把 dead-code 的 banner 渲染整理成可复用组件，如 `WelcomeBanner`）。
- `test/` — 状态行右对齐 + thinking 分行、留白高度、banner intro、不回归 覆盖。

## 规范（per ByAnDa，必带）
- 开发分支 `feature/spec-023-tui-statusline-polish`（从 `dev` 切）→ 自测/CI → **self-merge 回 `dev`**。禁用 `agent/<role>/<hash>` 名。
- **只做实施；禁止 publish/tag/release/version bump**（发布与版本由 owner）。
- clean-room；测试用 fake；`npm pack` 仍只 README + dist/index.js + package.json。

## 发布
self-merge 到 dev 后由 owner 发布（下一个小版本 0.0.14）。
