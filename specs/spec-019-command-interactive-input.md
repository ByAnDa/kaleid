---
项目: kaleid
文档: spec-019 — 命令无参时进入交互输入（/rename 等），不只靠后置参数
作者: kaleidLead
生成时间: 2026-05-22
Reviewer: ByAnDa
上游: spec-016(/rename) / spec-017(/project //chatlabel combobox)
状态: **待 ByAnDa 审核（审核通过后才派 Multica）**
编号: spec-019
依赖: spec-016（/rename，已在 dev）+ spec-017（combobox 组件，已在 dev）
类型: 交互一致性
---

# spec-019 — 命令无参进入交互输入

> 触发：ByAnDa msg=2e6a93d7 —— `/rename` 要能进入"输入名字"状态，不只通过后置参数；project / chatlabel 也是（统一）。

## 现状 / 范围澄清
- **`/project` //chatlabel**：spec-017 已是 combobox（列现有 + **自由输入**），无参即进交互、不强制带参 —— **已满足**。本 spec 只需确认一致、补缺口。
- **`/rename`**（spec-016）：当前**只接后置参数** `/rename <名称>` / `/rename <项目>/<名称>`，**无参时没有交互输入** —— 本 spec 主要补这个。

## 变更详述

### 1. `/rename` 无参 → 交互输入态
- `/rename`（不带参数）触发后，进入**交互输入模式**：输入区切到提示 `输入对话名称（可 项目/名称）：`，**预填当前名称**（可编辑）。
- 回车应用（解析 `项目/名称` 同 spec-016：含 `/` 则项目+名称，否则只名称）；Esc 取消。
- `/rename <名称>` / `/rename <项目>/<名称>` 带参形式**保留**（直接设、跳过交互）。
- 输入态期间普通文本/其它 slash 不误触发（同 spec-009/017 独占输入处理）。

### 2. 一致性：/project //chatlabel
- 确认二者无参时进 combobox（spec-017 已实现）；若有遗漏（如某路径仍强制要参数）则补齐为"无参进交互"。
- 三个命令（rename/project/chatlabel）交互行为一致：**无参进交互、带参直接设**。

### 3. 复用
- /rename 的交互输入是**纯文本输入**（无现有列表可选），复用 spec-017 OptionCombobox 的"自由输入"部分 或现有输入态机制（实装择简）；不必给 rename 配选择列表。

## 验收标准
1. WHEN `/rename`（无参）THEN 进入交互输入态、预填当前名称，输入新名回车应用，右上角更新、写回 metadata。
2. WHEN 交互输入 `项目/名称` THEN 同时设项目+名称（spec-016 解析规则）。
3. WHEN `/rename <名称>`（带参）THEN 仍直接设，跳过交互（不回归）。
4. WHEN `/project` / `/chatlabel`（无参）THEN 进交互（combobox，spec-017 行为）；带参直接设。
5. WHEN 交互输入态 Esc THEN 取消不改；普通文本/其它 slash 不误触发。
6. 防闪；clean-room；测试用 fake（/rename 无参交互、预填、解析、带参不回归）；typecheck/test/build/pack 全绿；pack 仍 3 文件。

## 涉及文件（修改）
- `src/tui/commands.ts` — `/rename` 无参 → 交互输入；与 /project //chatlabel 一致
- `src/tui/app.tsx` — rename 交互输入子状态、预填、提交
- `src/tui/components/`（InputBar / OptionCombobox 复用）— rename 纯文本输入态
- `test/` — /rename 无参交互/预填/解析/带参不回归 覆盖

## 规范（per ByAnDa）
- 开发分支 `feature/spec-019-command-interactive-input`（从 dev 切）→ 自测/CI → self-merge 回 dev。禁 agent/hash 名。
- 只实施；禁 publish/tag/Release/版本 bump（发布与版本由 owner）。
- clean-room；pack 仍 3 文件。

## 发布
self-merge 到 dev 后由 owner 发布（0.0.xx）。
