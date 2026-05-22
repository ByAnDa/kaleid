---
项目: kaleid
文档: spec-021 — 应用真实设计配色 + 像素级贴合（修正 spec-020 占位色）
作者: kaleidLead
生成时间: 2026-05-22
Reviewer: ByAnDa
上游: spec-020(TUI 重设计结构) / Claude Design bundle（已 commit 到 repo design/kaleid/）
状态: **待 ByAnDa 审核（审核通过后才派 Multica）**
编号: spec-021
依赖: spec-020（已在 dev）
类型: Bugfix / 设计贴合
---

# spec-021 — 应用真实设计配色 + 像素级贴合

> 触发：spec-020 结构 OK 但配色用了占位值（squad 当时抓不到 Claude Design URL）。ByAnDa msg=c10044a8 要求把 bundle 给到 Multica。**设计 bundle 现已 commit 到 repo `design/kaleid/`**（排除私有 uploads），Multica 可直接读，无需 fetch URL。

## 背景
spec-020 已交付 token 系统/双主题/降级/多行输入等**结构**，但 `daylight.ts`/`spectrum.ts` 里的颜色是占位（如 Daylight canvas `#fbfaf7` + 青蓝），**与设计的真实配色 0 命中**。本 spec 用真实设计 token 替换 + 视觉贴合。

## 设计来源（已在 repo，直接读，勿 fetch URL）
- **`design/kaleid/project/kaleid-tokens.js`** — token 单一来源（精确 hex）。
- **`design/kaleid/project/tui-screens.jsx`** — ChatScreen/ResumeScreen 布局。
- **`design/kaleid/project/screenshots/`** — 视觉目标（kaleid-final / tokens-light / tokens-dark-mid / canvas-overview）。
- **`design/kaleid/README.md` + `chats/chat1.md`** — 意图。
- ⚠️ `design/kaleid/project/uploads/` 不存在（已排除）；无需。

## 变更详述

### 1. 用真实 token 替换 daylight.ts / spectrum.ts
- 按 `kaleid-tokens.js` 的语义树**逐组、逐值**替换当前占位色，全部组：surface(canvas/panel/raised/chrome)、text(primary/secondary/muted/subtle/faint/onChrome)、border(strong/default/subtle)、accent(default/soft/on)、role(system/user/assistant/tool 各 fg+gutter)、status(ok/warn/err/info)、tag(review/wip/design/infra/planning/refactor/docs/inbox 各 bg+fg)、project(各 bg+fg)、selection(bg/fg)。
- 关键校验值（Daylight）：canvas `#f6f3ea`、accent.default `#b8431a`、text.primary `#28241b`、role.user `#0e547d`、role.assistant.gutter `#b8431a`。
- 关键校验值（Spectrum）：canvas `#0b0b14`、text.primary `#e6e3f0` 等（以 `kaleid-tokens.js` `modes.dark` 为准）。
- gutterStyle：Daylight=`bar`（细条）、Spectrum=`block`（2 字宽色块），按 tokens。

### 2. 像素级视觉贴合
- 对照 `screenshots/` + `tui-screens.jsx` 校准：gutter 宽度、角色前缀样式、tag/project 徽章配色与排布、顶部欢迎区、间距（px→字符格近似）、ResumeScreen 筛选栏与列表色块。
- 终端约束不变（无圆角/无字号字体/px→格），但**颜色与排布要贴合设计**。

### 3. 不动结构
- spec-020 的架构（主题选择/跟随终端/truecolor 降级/多行输入//theme/各组件）保留；本 spec 主要是**颜色值 + 视觉对齐**，必要时微调组件样式以贴合。

## 验收标准
1. WHEN Daylight THEN canvas/accent/text/role/status/tag/project/selection 各值**与 `design/kaleid/project/kaleid-tokens.js` 的 modes.light 逐一一致**（含 parchment `#f6f3ea`、烧橙 `#b8431a`）。
2. WHEN Spectrum THEN 各值与 `modes.dark` 逐一一致。
3. WHEN 渲染 ChatScreen/ResumeScreen THEN 视觉与 `screenshots/` 贴合（gutter/前缀/徽章/欢迎区/筛选栏配色排布）。
4. WHEN truecolor THEN 精确显示；256/16 降级保留语义。
5. spec-020 的功能（主题切换/跟随终端/多行输入/各 slash/选择器/记忆/rename/project·label/resume 筛选）不回归。
6. 防闪；clean-room（按设计还原，不抄 HTML）；测试用 fake；typecheck/test/build/pack 全绿；pack 仍 3 文件。

## 涉及文件（修改）
- `src/tui/theme/daylight.ts` / `spectrum.ts` — 全量替换为真实 token 值
- `src/tui/theme/fallback.ts` / `tokens.ts` — 如需配合
- `src/tui/components/*` — 视觉贴合微调（gutter 宽/徽章/布局）
- `test/` — 主题值与 design tokens 一致性断言（可对几个关键值）+ 不回归

## 规范（per ByAnDa）
- 开发分支 `feature/spec-021-apply-real-design-colors`（从 dev 切）→ self-merge 回 dev。禁 agent/hash 名。
- 只实施；禁 publish/tag/release/version bump（发布与版本由 owner）。
- clean-room；pack 仍 3 文件。

## 发布
self-merge 到 dev 后由 owner 发布（0.0.xx，建议与 spec-020 合为同一发布 0.0.12）。
