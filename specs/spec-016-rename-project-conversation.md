---
项目: kaleid
文档: spec-016 — /rename 对话命名 + 项目/对话两级 + 输入框右上角常显
作者: kaleidLead
生成时间: 2026-05-22
Reviewer: ByAnDa
上游: spec-014(会话持久化/resume) / spec-010(全屏 TUI) / spec-011(header)
状态: 待实现
编号: spec-016
依赖: 0.0.9（dev）
类型: 功能新增
---

# spec-016 — `/rename` 对话命名 + 项目/对话两级

> 触发：ByAnDa msg=0fd47514 —— 增加 `/rename` 改对话名称（resume 窗口显示用），并常驻在下方输入框右上角；对话分两级：**项目 - 对话名称**，默认无项目。

## 背景
spec-014 已有会话持久化（`~/.kaleid/sessions/<id>.jsonl`）+ metadata + resume。本 spec 给会话加**可编辑名称 + 项目两级**，并在 TUI 常显、用于 resume 列表。

## 变更详述

### 1. 会话 metadata 加 project + name（src/loop/session-store.ts）
- session metadata 扩展：`{ id, project: string | null, name: string, created, model, effort, ... }`。
- 默认：`project = null`（无项目）；`name` 默认从首条 user 消息取摘要（截断）或 `untitled`。
- 改名/改项目后写回 jsonl metadata（持久化）。

### 2. `/rename` 命令（src/tui/commands.ts）
- `/rename <名称>` → 设置当前对话名称。
- 两级支持：`/rename <项目>/<名称>` → 同时设项目+名称（含 `/` 视为 `项目/名称`）；不含 `/` 则只改名称、项目不变。
- 也可允许 `/rename <名称> --project <项目>`（择一实现，优先 `项目/名称` 简洁式）。
- 改完在对话区提示 `已重命名: <项目 - 名称>`（无项目则 `已重命名: <名称>`），并写回 metadata。
- 加入 slash 命令表 + 补全菜单（spec-008 框架）。

### 3. 输入框右上角常显（src/tui/components/InputBar.tsx）
- 在**下方输入框区域的右上角**常显当前对话标识：`项目 - 对话名称`（无项目则只显示 `对话名称`）。
- 与屏幕顶部 header（model · effort，spec-011）区分：这是输入框区右上角，显示对话身份。
- 改名后实时更新；防闪沿用 spec-010 diff renderer（只 patch 该处）。
- 名称过长截断。

### 4. resume 列表用 项目-名称 显示（src/loop/session-store.ts + resume 选择器）
- spec-014 的 `--resume` / `/resume` 会话选择器列表项**用 `项目 - 名称` 显示**（替代 id/首条消息摘要），更可读；同项目可分组或排序（简单按项目+时间）。
- `--continue` 仍恢复最近会话。

## 验收标准
1. WHEN `/rename 我的重构任务` THEN 当前对话名称改为"我的重构任务"，写回 jsonl metadata，输入框右上角实时显示该名称。
2. WHEN `/rename kaleid/修复登录` THEN 项目=kaleid、名称=修复登录；右上角显示 `kaleid - 修复登录`。
3. WHEN 新会话未命名 THEN 右上角显示默认名称（首条消息摘要或 untitled），项目默认无（只显示名称）。
4. WHEN `/resume`（或 `--resume`）THEN 列表用 `项目 - 名称` 显示各历史会话，可选会话恢复。
5. WHEN 改名后 resume THEN 列表显示的是改后的名称。
6. WHEN 名称过长 THEN 右上角截断不破坏布局。
7. 防闪：右上角/输入区更新只 patch 变化行；clean-room；测试用 fake（rename 写读 jsonl 临时目录、resume 列表显示）；typecheck/test/build/pack 全绿；pack 仍 3 文件。

## 涉及文件（修改）
- `src/loop/session-store.ts` — metadata 加 project/name + 读写 + resume 列表数据
- `src/tui/commands.ts` — `/rename`（+ 补全）
- `src/tui/app.tsx` — /rename 处理、会话名状态、传给 InputBar
- `src/tui/components/InputBar.tsx` — 右上角常显 `项目 - 名称`
- resume 选择器组件 — 列表项显示 `项目 - 名称`
- `test/` — /rename（仅名称 / 项目+名称）、metadata 持久化、resume 列表显示、截断 覆盖

## 发布
self-merge 到 dev 后作为 **0.1.0** 发布（功能积累到一定程度，建议跳 minor）；或按序 0.0.10 —— 由项目所有者发布时定版本号。
