---
项目: kaleid
文档: spec-018 — resume 选择器加 project / label 筛选
作者: kaleidLead
生成时间: 2026-05-22
Reviewer: ByAnDa
上游: spec-014(resume 选择器) / spec-016(project/name) / spec-017(labels + distinct 聚合)
状态: **待 ByAnDa 审核（通过后才派 Multica）**
编号: spec-018
依赖: **spec-016 + spec-017 完成合 dev 之后再实施**（用其 project/label metadata + 聚合，串行）
类型: 功能新增
---

# spec-018 — resume 选择器 project / label 筛选

> 触发：ByAnDa msg=3d51a8f1 —— resume 命令的会话列表上方加筛选：project（默认不筛选）+ label（默认不筛选）；选中筛选项后进入对应列表选择，选完返回，只显示该 project / label 的对话；label 同逻辑。
> TUI 可行性：✅ ink 完全能做（已有 OptionSelector/OptionCombobox + 子状态导航，筛选栏=多级选择）。

## 背景
spec-014 的 `--resume` / `/resume` 会话选择器列出历史会话（spec-016/017 后按 `项目 - 名称 #标签` 显示）。本 spec 在其**上方加筛选栏**，按 project / label 过滤列表。

## 变更详述

### 1. resume 选择器顶部筛选栏
- 列表上方常显两个筛选器：
  - `project: 全部`（默认不筛选）
  - `label: 全部`（默认不筛选）
- 焦点可在 [project 筛选] / [label 筛选] / [会话列表] 间切换（Tab 或方向键约定，spec 实装定）。

### 2. 筛选交互（drill-in）
- **选中 project 筛选 → 进入 project 列表**（现有 distinct projects，来自 spec-017 的聚合 + "全部"项）→ 选一个 → **返回**，会话列表**只显示该 project 的对话**。
- **label 筛选同逻辑**：进入 label 列表（distinct labels + "全部"）→ 选一个 → 返回，只显示**含该 label** 的对话。
- 两个筛选可同时生效（**AND**：既属该 project 又含该 label）。
- 选"全部"= 清除该维度筛选。
- 筛选后列表为空时给"无匹配会话"提示。

### 3. 数据
- distinct projects / labels 来自 spec-017 在 session-store 的聚合（扫所有会话 metadata 去重）。
- 过滤纯在已加载的会话列表上做（会话数不大，内存过滤即可）。

### 4. 复用组件
- 筛选项的列表选择复用 spec-011 OptionSelector；resume 主列表复用 spec-014 的选择器；筛选栏 + 子列表 + 返回 = ink 子状态切换（无新渲染难点，防闪沿用 diff renderer）。

## 验收标准
1. WHEN 打开 resume 选择器 THEN 列表上方显示 `project: 全部` + `label: 全部`（默认不筛选，列出全部会话）。
2. WHEN 选中 project 筛选 THEN 进入现有 project 列表（含"全部"），选一个后返回，会话列表只显示该 project 的对话。
3. WHEN 选中 label 筛选 THEN 进入现有 label 列表，选一个后返回，只显示含该 label 的对话。
4. WHEN project + label 都选 THEN AND 过滤（同时满足）。
5. WHEN 任一筛选选"全部" THEN 清除该维度筛选。
6. WHEN 过滤后无匹配 THEN 提示"无匹配会话"，不崩。
7. WHEN 选中某会话回车 THEN 正常 resume 该会话（spec-014 行为不变）。
8. 防闪；clean-room；测试用 fake（聚合 distinct、按 project/label 过滤、AND、清除、空结果）；typecheck/test/build/pack 全绿；pack 仍 3 文件。

## 涉及文件（修改）
- `src/loop/session-store.ts` — 暴露 distinct projects/labels（spec-017 已加，复用）+ 按 project/label 过滤会话列表的辅助
- resume 选择器组件（spec-014）— 顶部筛选栏 + drill-in project/label 子列表 + 返回 + 过滤
- `src/tui/app.tsx` — resume 筛选子状态
- `test/` — 筛选交互、AND、清除、空结果、resume 不回归 覆盖

## 发布
从 `dev` 切 **`feature/spec-<编号>-<slug>`** 分支开发 → CI/自测 → **self-merge 回 dev**（勿用 Multica 自动 hash 分支名；勿自行 npm publish，发布由 owner 执行）。版本号由项目所有者定。
