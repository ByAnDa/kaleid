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

### 2. `/project` 命令（src/tui/commands.ts）
- `/project <名称>` → 设置当前对话的 project。
- `/project`（无参）或 `/project -`（待定）→ 清空 project（回到"无项目"）。
- 改完提示 `已设置项目: <project>`（或"已清空项目"），写回 metadata，右上角实时更新。
- 与 spec-016 `/rename` 的"项目/名称"并存：`/project` 只改项目、不动名称。

### 3. `/chatlabel` 命令（多标签）
- `/chatlabel <标签>` → 给当前对话**追加**一个标签（一个对话可多个标签，去重）。
- `/chatlabel remove <标签>`（或 `-rm`）→ 移除某标签。
- `/chatlabel`（无参）→ 列出当前标签（或提示用法）。
- 改完提示 + 写回 metadata + 右上角实时更新。
- （命令名最终拼写以 ByAnDa 确认为准；默认 `/chatlabel`。）

### 4. 输入框右上角常显：项目 - 名称 + 标签（src/tui/components/InputBar.tsx）
- 右上角常显合并展示：`<项目> - <对话名称>  #标签1 #标签2 ...`
  - 无项目：只 `<对话名称> #标签...`；无标签：只 `<项目> - <名称>`。
- 标签用 `#` 前缀或方括号区分（实装择一，清晰即可）。
- 实时更新（/rename //project //chatlabel 后）；过长截断（标签多时优先保名称、标签溢出省略 `+N`）。
- 防闪沿用 spec-010 diff renderer。

### 5. resume 列表（可选增强）
- spec-014/016 的 resume 列表项可附标签显示（`项目 - 名称 #标签`），便于辨识；非必需，加分。

## 验收标准
1. WHEN `/project kaleid` THEN 当前对话 project=kaleid，右上角显示含 `kaleid - <名称>`，写回 metadata。
2. WHEN `/project`（清空）THEN project 回到无，右上角只显名称(+标签)。
3. WHEN `/chatlabel bug` 再 `/chatlabel urgent` THEN 对话有两个标签 [bug, urgent]，右上角显示 `... #bug #urgent`，去重。
4. WHEN `/chatlabel remove bug` THEN 移除 bug 标签。
5. WHEN 右上角 THEN 常显 `项目 - 名称 + 标签`，三者随命令实时更新；过长截断不破坏布局。
6. WHEN resume THEN metadata 的 project/name/labels 正确恢复。
7. 防闪；clean-room；测试用 fake（/project //chatlabel 读写 jsonl 临时目录、右上角格式、去重、移除）；typecheck/test/build/pack 全绿；pack 仍 3 文件。

## 涉及文件（修改）
- `src/loop/session-store.ts` — metadata 加 labels + 读写
- `src/tui/commands.ts` — `/project` + `/chatlabel`（+ 补全）
- `src/tui/app.tsx` — 命令处理、project/labels 状态、传 InputBar
- `src/tui/components/InputBar.tsx` — 右上角合并显示 项目-名称+标签
- （可选）resume 选择器 — 列表附标签
- `test/` — /project（设/清）、/chatlabel（加/去重/移除/列出）、右上角格式、持久化、resume 覆盖

## 发布
self-merge 到 dev 后发布（版本号由项目所有者定）。
