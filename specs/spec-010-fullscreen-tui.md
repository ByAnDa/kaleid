---
项目: kaleid
文档: spec-010 — 全屏 TUI 改版（header 线框 + 对话区 + 固定输入）
作者: kaleidLead
生成时间: 2026-05-22
Reviewer: ByAnDa
上游: PRD `kaleid PRD v0.3.md` F5 / spec-007(TUI) / spec-008(slash) / spec-009(/login)
状态: 待实现
编号: spec-010
依赖: 已发布 0.0.3（dev）
类型: TUI 改版
---

# spec-010 — 全屏 TUI（header / 对话区 / 固定输入）

> 触发：ByAnDa msg=34adca48 —— 进入后整个 TUI 全屏；顶部线框写 kaleid；中间是与 AI 的对话区；最下文本输入框固定；AI 与用户消息要有区分。

## 目标
把 REPL 从「追加滚动」改为**全屏固定布局**：顶部标题栏 + 中部可滚动对话区 + 底部固定输入框；用户与 AI 消息视觉区分。

## 布局（全屏，flexDirection column，高度=终端行数）
```
┌────────────────────────────────────────────┐   ← 顶部 header，圆角线框，固定
│ kaleid                                       │     框内文字 "kaleid"（可带版本/状态）
└────────────────────────────────────────────┘
                                                   ← 中部：对话区（flexGrow=1，占满剩余高度）
  you › 帮我读一下 package.json                       用户消息（区分样式）
  kaleid › 好的，我来看一下…                            AI 消息（区分样式）
  ⏺ bash(ls) ✔ …                                   工具调用（再一种样式）
  …（新消息自动贴底；超出区域的旧消息上滚）
┌────────────────────────────────────────────┐   ← 底部：输入框，固定在最下
│ › <光标>                                      │
└────────────────────────────────────────────┘
```

### 1. 全屏 + alternate screen
- 进入 REPL 时切到**全屏**：占满终端宽高；建议进 alternate screen（`\x1b[?1049h` 进 / `\x1b[?1049l` 出，或等价 ink 全屏方案），退出时还原用户原有终端内容（不污染 scrollback）。
- 监听终端 **resize**（`stdout` columns/rows 变化）→ 重新布局，不错位。

### 2. 顶部 header（固定）
- 圆角线框（ink `borderStyle="round"`），框内文字 `kaleid`（可附极简信息，如右侧显示当前 model 或登录状态，简洁即可）。
- 固定在顶部，不随对话滚动。

### 3. 中部对话区（可滚动）
- `flexGrow={1}` 占满 header 与输入框之间的剩余高度。
- 显示对话消息流；**新消息自动贴底**（最新消息始终可见）。
- 内容超出可视高度时：旧消息自然上滚出可视区（V1 至少做到"自动贴底显示最近 N 条能放下的"；上翻历史可作为加分项/后续）。
- 流式：AI 回复 token 增量更新当前消息（在对话区底部那条）。

### 4. 底部输入框（固定）
- 固定在终端最底部一行/区域（可加细线框或前缀 `›`）。
- 复用 spec-008 的 slash 解析 + 补全菜单（输入 `/` 弹命令菜单，菜单浮在输入框上方）。
- 复用 spec-009 的 `/login` 粘贴模式（`oauth>` 提示也在此输入区切换）。

### 5. 用户 vs AI 消息区分（必做）
- **用户消息**：标签 `you ›`（绿色 / 加粗）。
- **AI 消息**：标签 `kaleid ›`（青色）。
- **工具调用**：第三种样式（如紫色 `⏺ tool(args)` + ✔/✘ + 结果摘要），与前两者区别开。
- 系统/命令反馈（/help 列表、登录提示等）：第四种淡色样式。
- 区分手段：颜色 + 标签前缀（必要）；可选不同缩进/对齐增强区分。

### 6. 防闪（硬要求）
- 全屏固定布局下**不得整屏闪烁**：进 alt-screen + 布局结构稳定（header/footer 高度固定，仅中部内容变）+ 依赖 ink reconciler 只 patch 变化行，**不要每帧整屏 clear**。
- 流式更新只动"对话区最后一条 + 输入区"，header 不重绘。
- resize/长输出时也不应大面积闪烁。
- 注：这是 ink 全屏布局的难点；若实测仍有明显闪烁，在 issue 里说明并给出已尝试的缓解，便于评估是否需要更底层渲染方案。

## 不做（留后续）
- 历史上翻/滚动条/鼠标滚轮、主题切换、多面板 —— 本轮只要"全屏三段式布局 + 自动贴底 + 消息区分 + 不闪"。

## 验收标准
1. WHEN `kaleid` 进入 REPL THEN 整个终端进入全屏：顶部圆角线框含 `kaleid`、中部对话区、底部固定输入框三段式布局。
2. WHEN 退出（`/exit` / Ctrl+C）THEN 还原用户终端原内容（alt-screen 退出干净）。
3. WHEN 多轮对话累积超过可视高度 THEN 自动贴底显示最新消息，输入框始终固定在最下、header 固定在最上。
4. WHEN AI 流式回复 THEN 对话区底部那条增量更新，无整屏闪烁。
5. WHEN 终端窗口 resize THEN 布局自适应、不错位、不大面积闪。
6. WHEN 用户消息 vs AI 消息 vs 工具调用 THEN 三者视觉明显区分（颜色+标签）。
7. WHEN 输入 `/` THEN 命令补全菜单出现在输入框上方（spec-008 行为保留）；`/login` 粘贴模式（spec-009）正常。
8. clean-room；测试用 fake；typecheck/test/build/pack 全绿；`npm pack` 仍只 README+dist+package.json。

## 涉及文件（修改/新增）
- `src/tui/app.tsx` — 全屏布局（column：Header / Conversation / InputBar）、alt-screen 进出、resize、自动贴底
- `src/tui/components/Header.tsx`（新建）— 顶部 kaleid 线框
- `src/tui/components/Conversation.tsx`（新建，建议）— 中部对话区 + 自动贴底
- `src/tui/components/Message.tsx` — 用户/AI/工具/系统 四类样式区分
- `src/tui/components/InputBar.tsx`（新建，建议）— 底部固定输入 + slash 菜单 + oauth 粘贴模式
- `test/` — 布局/消息区分/slash 菜单回归

## 发布
self-merge 到 dev 后作为 **0.0.4** 发布（发布动作由项目所有者执行）。
