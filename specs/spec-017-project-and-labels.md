---
项目: kaleid
文档: spec-017 — /project 改项目 + /chatlabel 对话标签（多标签）+ 右上角常显
作者: kaleidLead
生成时间: 2026-05-22
Reviewer: ByAnDa
上游: spec-016(/rename + 项目/对话名 + 右上角显示) / spec-014(会话持久化)
状态: **待 ByAnDa 审核（审核通过后才派 Multica）**
编号: spec-017
依赖: **spec-016（BYW-112）完成并合 dev 之后再实施**（共享会话 metadata + 右上角显示，串行）
类型: 功能新增
---

# spec-017 — `/project` 改项目 + `/chatlabel` 对话多标签

> 触发：ByAnDa msg=2ef50b14 —— `/project` 改当前对话的 project；`/chatlabel` 给对话加标签（一个对话可多个标签）；project + 标签 + 对话名称都常驻显示在输入框右上角。
> 命名：`/chatlable` 按"label"理解为 **`/chatlabel`**（待 ByAnDa 确认命令名拼写）。

## 背景
spec-016 已给会话 metadata 加 `project` + `name`，并在输入框右上角显示 `项目 - 名称`。本 spec 加：单独的 `/project` 命令 + `/chatlabel` 多标签，并把标签一起常显。

## 变更详述

### 1. 会话 metadata 加 labels（src/loop/session-store.ts）
- metadata 扩展：`labels: string[]`（默认 `[]`）。（已有 `project`/`name` from spec-016。）
- 改 project/labels 后写回 `~/.kaleid/sessions/<id>.jsonl` metadata。

### 1b. 现有 project / label 聚合（src/loop/session-store.ts）
- 提供"列出所有历史会话里**已用过的 distinct project / distinct label**"的能力（扫 `~/.kaleid/sessions/*.jsonl` 的 metadata，去重）。供 `/project` //chatlabel 的选择列表用。

### 2. `/project` 命令（combobox：选现有 或 输入新的，ByAnDa msg=60962132）
- `/project` 触发后弹出 **combobox**：
  - 列出**现有 project**（去重）供选择，**上下箭头**高亮选择；
  - **或直接输入**新名称——**一旦用户开始输入，选择列表消失**，按输入的值来；
  - **回车**应用（未输入则用高亮的现有项；已输入则用输入值）；**Esc** 取消。
- 也支持一步式 `/project <名称>`（带参直接设，跳过选择）。
- 应用后写回 metadata、右上角实时更新、提示 `已设置项目: <project>`。
- 清空项目：选择列表里提供"(无项目)"选项 或 `/project` 后输入空（实装择一，保证可清空）。
- `/project` 只改项目、不动名称（与 spec-016 `/rename` 并存）。

### 3. `/chatlabel` 命令（多标签 + combobox）
- `/chatlabel` 触发后弹出 **combobox**（同上交互）：
  - 列出**现有 label**（所有会话里用过的、去重）供上下箭头选择；
  - 或直接输入新标签，**输入即列表消失、按输入来**；回车追加该标签，Esc 取消。
- **多标签**：一个对话可多个，**追加 + 去重**。
- 移除：`/chatlabel remove <标签>`（或选择器里对已有标签标记移除）；无参时也可先列当前标签。
- 一步式 `/chatlabel <标签>` 带参直接追加。
- 应用后写回 metadata、右上角实时更新。
- （命令名 `/chatlabel` 待 ByAnDa 确认拼写。）

> combobox = 现有项选择列表 + 自由输入二合一（输入时隐藏列表、以输入为准）。可在 spec-011 的 OptionSelector 基础上扩一个"可输入"变体（OptionCombobox），`/project` //chatlabel 共用。

### 4. 输入框右上角常显：项目 - 名称 + 标签（src/tui/components/InputBar.tsx）
- 右上角常显合并展示：`<项目> - <对话名称>  #标签1 #标签2 ...`
  - 无项目：只 `<对话名称> #标签...`；无标签：只 `<项目> - <名称>`。
- 标签用 `#` 前缀或方括号区分（实装择一，清晰即可）。
- 实时更新（/rename //project //chatlabel 后）；过长截断（标签多时优先保名称、标签溢出省略 `+N`）。
- 防闪沿用 spec-010 diff renderer。

### 5. resume 列表（可选增强）
- spec-014/016 的 resume 列表项可附标签显示（`项目 - 名称 #标签`），便于辨识；非必需，加分。

## 验收标准
1. WHEN `/project` THEN 弹 combobox 列出现有 project，上下箭头可选；回车应用高亮项，右上角更新，写回 metadata。
2. WHEN `/project` 后**直接输入**新名称 THEN 选择列表消失、按输入值设 project（回车应用）。
3. WHEN `/project kaleid`（带参）THEN 直接设 project=kaleid。
4. WHEN 清空项目（"(无项目)"选项 / 空输入）THEN project 回无，右上角只显名称(+标签)。
5. WHEN `/chatlabel` THEN 弹 combobox 列出现有 label，可上下选 或 直接输入新标签；应用后**追加**到当前对话（去重）。
6. WHEN `/chatlabel bug` 再 `/chatlabel urgent` THEN 标签 [bug, urgent]，右上角 `... #bug #urgent`。
7. WHEN `/chatlabel remove bug` THEN 移除 bug。
8. WHEN 右上角 THEN 常显 `项目 - 名称 + #标签`，三者随命令实时更新；过长截断 `+N` 不破坏布局。
9. WHEN resume THEN metadata 的 project/name/labels 正确恢复；现有 project/label 聚合正确（去重）。
10. 防闪；clean-room；测试用 fake（combobox 选/输入、distinct 聚合、/project //chatlabel 读写 jsonl 临时目录、去重、移除）；typecheck/test/build/pack 全绿；pack 仍 3 文件。

## 涉及文件（修改/新增）
- `src/loop/session-store.ts` — metadata 加 labels + 读写 + **distinct project/label 聚合**
- `src/tui/commands.ts` — `/project` + `/chatlabel`（+ 补全）
- `src/tui/components/OptionCombobox.tsx`（新建，建议）— 可输入的选择器（现有项列表 + 自由输入，输入时隐藏列表），`/project` //chatlabel 共用
- `src/tui/app.tsx` — 命令处理、combobox 子状态、project/labels 状态、传 InputBar
- `src/tui/components/InputBar.tsx` — 右上角合并显示 项目-名称+标签
- （可选）resume 选择器 — 列表附标签
- `test/` — combobox 选/输入、distinct 聚合、/project（设/清）、/chatlabel（加/去重/移除/列出）、右上角格式、持久化 覆盖

## 发布
从 `dev` 切 **`feature/spec-<编号>-<slug>`** 分支开发 → CI/自测 → **self-merge 回 dev**（勿用 Multica 自动 hash 分支名；勿自行 npm publish，发布由 owner 执行）。版本号由项目所有者定。
