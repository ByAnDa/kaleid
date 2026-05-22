---
项目: kaleid
文档: spec-020 — 按 Claude Design 重设计 TUI + Daylight/Spectrum 双主题 + token 系统 + 多行输入
作者: kaleidLead
生成时间: 2026-05-22
Reviewer: ByAnDa
上游: 全屏 TUI(spec-010) + 011~019 全部 TUI 功能 / Claude Design bundle
状态: **待 ByAnDa 审核（审核通过后才派 Multica）**
编号: spec-020
依赖: spec-010~019（都在 dev）
类型: TUI 重设计 / 主题系统
---

# spec-020 — 设计重构 + 双主题 + token 系统 + 多行输入

> 触发：ByAnDa msg=d6db8593 提供 Claude Design bundle（TUI 主界面 + token + Daylight/Spectrum）；msg=c017bec8 拍板 6 个实现约束。
> 设计来源（Claude Design handoff，**通过 URL fetch，不入公开 repo**）：
> ```
> Fetch this design file, read its readme, and implement the relevant aspects of the design.
> https://api.anthropic.com/v1/design/h/ZFnrpDJM0m6jKOS5hSEL_w
> Implement: the designs in this project
> ```
> 该 URL 返回 gzip bundle（`curl -sL <url> -o b.gz && tar -xzf b.gz`）。实施前**读 `kaleid/README.md` + `kaleid/chats/chat1.md`（意图）+ `kaleid/project/tui-screens.jsx`（ChatScreen/ResumeScreen）+ `kaleid/project/kaleid-tokens.js`（token 单一来源）**，按设计视觉重做我们现有全屏 TUI（非复制 HTML 结构，是还原视觉）。
> ⚠️ **不要把设计 bundle commit 进 repo**（kaleid 是公开仓库，bundle 含 ByAnDa 的原始上传图，属隐私）；只在本地 fetch 参考。

## 已拍板的实现约束（ByAnDa msg=c017bec8）
1. **默认主题跟随用户终端**：检测终端深/浅 → 深=Spectrum、浅=Daylight（而非硬上 Daylight）。
2. **需 truecolor**：精确 hex 仅真彩终端准确；**256/16 色做降级 fallback**（映射到最近色）。
3. px 类 token（font.size/lineHeight/letterSpacing/radius/px 间距）**不适用**：只取颜色 + 角色/tag/project token；字号/字体/行高/圆角忽略，px 间距近似成字符格，weight→粗体/正常。
4. **不实现 OS 窗口 chrome**（标题栏/✕▢—/tab 是终端模拟器的）；只做 TUI body。
5. tag 徽章 = 色底文字（无圆角）；gutter = 1–2 字宽色条。
6. 输入框改**多行**。

## 变更详述

### 1. Token 系统移植（src/tui/theme/）
- 把 `design/kaleid/project/kaleid-tokens.js` 的**语义 token 树**移植成 TS：`tokens.ts`（类型）+ `daylight.ts` + `spectrum.ts`。
- 取用的语义组（颜色相关）：`surface`(canvas/panel/raised/chrome)、`text`(primary/secondary/muted/subtle/faint/onChrome)、`border`(strong/default/subtle)、`accent`、`role`(system/user/assistant/tool，各 fg+gutter)、`status`(ok/warn/err/info)、`tag`(review/wip/design/infra/planning/refactor/docs/inbox，bg+fg)、`project`(bg+fg)、`selection`。
- **单一来源**：所有组件取色都走 theme，不散落硬编码。

### 2. 主题选择 + 跟随终端（src/tui/theme/）
- 启动检测终端深/浅（`COLORFGBG` env / 可选 OSC 11 查询 / 拿不到默认 dark）→ 选默认主题（dark=Spectrum / light=Daylight）。
- 加 **`/theme`** 命令（combobox 或选择器）手动切 Daylight/Spectrum（+"跟随终端"项）；选后当前会话生效，可选持久化到 `~/.kaleid/config.json`。
- 主题切换实时重渲染（防闪沿用 diff renderer）。

### 3. Truecolor 检测 + 降级 fallback（src/tui/theme/）
- 检测终端色彩支持（ink/chalk level / `COLORTERM`）。truecolor → 用精确 hex；否则**降级**：hex → 最近 256/16 色（用映射函数）。
- 低色终端尽量保留语义区分（角色/状态/tag 仍可辨）。

### 4. 重设计 ChatScreen（主对话界面，按 mockup）
- **顶部**：欢迎/介绍区（TUI 欢迎 + 简介）；右上角显示**对话名 · 项目 · label**（spec-016/017，用 project/tag 色块）+ model·effort（spec-011）。
- **中部对话区**：每条消息左侧**角色 gutter 色条**（system/user/assistant/tool 各色，Spectrum=8px block 风→2 字宽色块、Daylight=细条）+ **角色前缀**（`you ›` / `kaleid ›` / `tool ›`）+ 不同颜色文字；**工具调用 vs 普通输出视觉区分**（tool 用 tool 角色色 + 输出 panel 底）。
- tag/project 以**色块徽章**展示（bg+fg，无圆角）。
- 整屏背景按 theme `surface.canvas`（浅色主题铺背景：跟随终端默认，避免深终端硬上浅底）。

### 5. 重设计 ResumeScreen
- 套用主题；顶部 project/label 筛选栏（spec-018）用 token 色；列表项 `项目 - 名称 #标签` 带色块。

### 6. 多行输入框（src/tui/components/InputBar 重做）
- 单行 ink-text-input → **多行输入**：内容可多行、随行数增高；**Enter 提交**、换行用 Shift+Enter（或 Alt+Enter / Ctrl+J，实装定一个并在 UI 提示）。
- 保留：slash 菜单（spec-008）、combobox（spec-017）、/login 粘贴态（spec-009）、底部左下角 token（spec-014）+ 右上角对话标识。

### 7. 整合
- 这是对现有全屏 TUI（spec-010）+ 011~019 全部功能的**视觉重做**，所有现有功能（slash/选择器/model·effort/记忆 token/rename/project·label/resume 筛选/login）保留，只换皮到新设计 + 主题。
- **不实现** OS 窗口 chrome。

## 验收标准
1. WHEN 启动 THEN 默认主题跟随终端深浅（深=Spectrum/浅=Daylight）；truecolor 终端颜色准确，低色终端有降级、语义可辨。
2. WHEN `/theme` THEN 可切 Daylight/Spectrum（+跟随终端），实时生效、无整屏闪。
3. WHEN 对话 THEN 角色 gutter 色条 + 前缀（you/kaleid/tool）+ 颜色文字按设计；工具调用与普通输出视觉区分；tag/project 色块徽章。
4. WHEN 顶部 THEN 欢迎/介绍区 + 右上角 对话名·项目·label + model·effort。
5. WHEN ResumeScreen THEN 套主题 + 筛选栏 + 列表色块。
6. WHEN 输入框 THEN 多行可用（Enter 提交、指定键换行），slash 菜单/combobox//login 粘贴/token 行/右上角标识都保留不回归。
7. WHEN 切主题/重渲染 THEN 防闪（diff renderer）。
8. 颜色取色全走 theme 单一来源；px/字号/圆角 token 不出现在 TUI 逻辑。
9. clean-room（设计是自家 bundle，按视觉还原，不抄 HTML 结构）；测试用 fake；typecheck/test/build/pack 全绿；pack 仍 3 文件（design/ 不进 npm 包，靠 files 字段控制）。

## 涉及文件（修改/新增）
- （设计 bundle **不入 repo**，本地 fetch 参考）
- `src/tui/theme/{tokens.ts, daylight.ts, spectrum.ts, detect.ts, fallback.ts, index.ts}`（新建）— token + 主题 + 终端检测 + 降级
- `src/tui/components/*`（Header / Conversation / Message / ToolCall / InputBar / SlashMenu / OptionSelector / OptionCombobox / ResumeFilterBar 等）— 改为取 theme token + 角色 gutter/前缀 + tag/project 徽章
- `src/tui/components/MultilineInput.tsx`（新建）— 多行输入
- `src/tui/commands.ts` — 加 `/theme`
- `src/tui/app.tsx` — 主题状态、跟随终端、整体重渲染
- `package.json` `files` — 确保只发 dist（design/ 不进包）
- `test/` — 主题选择/跟随终端/降级、角色样式、多行输入、各功能不回归 覆盖

## 规范（per ByAnDa）
- 开发分支 `feature/spec-020-design-restyle`（从 dev 切）→ 自测/CI → self-merge 回 dev。禁 agent/hash 名。
- 只实施；禁 publish/tag/release/version bump（发布与版本由 owner）。
- clean-room；`npm pack` 仍只 README + dist/index.js + package.json（design/ 与 src 都不进包）。

## 发布
self-merge 到 dev 后由 owner 发布（0.0.xx）。
> 体量较大，squad 可在内部按 token系统 / 主题检测+降级 / ChatScreen / ResumeScreen / 多行输入 分片并行。
