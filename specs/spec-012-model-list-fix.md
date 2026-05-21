---
项目: kaleid
文档: spec-012 — 修正模型清单(对齐 pi openai-codex) + /model 选完链式选 effort
作者: kaleidLead
生成时间: 2026-05-22
Reviewer: ByAnDa
上游: spec-011(/model + /reasoning) / spec-010(全屏 TUI)
状态: 待实现
编号: spec-012
依赖: 0.0.5（dev，spec-011）
类型: 修正 + 交互增强
---

# spec-012 — 模型清单对齐 pi + 模型→effort 链式选择

> 触发：ByAnDa msg=59c0489c —— 0.0.5 的模型表与 pi 不一致；且选完模型没接着选 effort。

## 背景
- 0.0.5 的 `AVAILABLE_MODELS` 用了错误的候选（gpt-5.5-pro + 一批 -codex 后缀），与 pi 的 `[openai-codex]` 实际列表不符。
- pi 不实时读模型；它 bundle 离线生成的注册表按 provider 过滤。Codex OAuth 无干净的实时 list-models 接口 → kaleid 同样 bundle 一份对齐 pi 的清单。
- `/model` 与 `/reasoning` 当前独立，选完模型不会接着让用户选 effort。

## 变更详述

### 1. 修正可用模型清单（对齐 pi openai-codex）
`src/provider/models.ts` 的 `AVAILABLE_MODELS` 改为与 pi `[openai-codex]` 一致（顺序参考 pi）：
```
o4-mini-deep-research
gpt-5.2
gpt-5.3-codex
gpt-5.3-codex-spark
gpt-5.4
gpt-5.4-mini
gpt-5.5            (DEFAULT_MODEL，保持 gpt-5.5)
```
- 删除 0.0.5 里错误的 `gpt-5.5-pro` / `gpt-5.2-codex` / `gpt-5.1-codex` / `gpt-5-codex`。
- 列表是**对齐 pi 的 bundled 清单**（非实时查询）。注释里写明来源（pi openai-codex 模型表）+ 后续可同步。
- 仍单一来源；选择器/header/provider 共用。
- 可选（加分，贴近 pi 观感）：每项后缀 provider 标签 `[openai-codex]`。

### 2. `/model` 选完链式进入 effort 选择
- `/model` 流程改为两步：选模型（回车应用）→ **自动接着弹出 effort 选择器**（minimal/low/medium/high/xhigh，标注当前、箭头高亮、回车应用）→ 完成后回到对话，提示 `已设置: <model> · <effort>`。
- 任一步 Esc：仅取消该步（模型已选则保留模型、跳过改 effort；或整体取消——实现选其一并在对话区给清晰提示，推荐"Esc 跳过 effort、保留已选模型"）。
- `/reasoning` 仍保留为**单独**入口（只改 effort 不动模型）。
- 复用 spec-011 的 OptionSelector 组件。

### 3. header 不变
- 仍右上角 `model · effort`，切换后实时更新（spec-010/011 已实现）。

## 验收标准
1. WHEN `/model` THEN 列出的模型与 pi `[openai-codex]` 一致（o4-mini-deep-research / gpt-5.2 / gpt-5.3-codex / gpt-5.3-codex-spark / gpt-5.4 / gpt-5.4-mini / gpt-5.5），当前项标注、默认 gpt-5.5。
2. WHEN 在 `/model` 选定模型回车 THEN 自动进入 effort 选择器；选定 effort 回车后回到对话，header 显示 `model · effort`，对话区提示已设置。
3. WHEN effort 步 Esc THEN 保留已选模型、不改 effort（或按实现的取消语义，给清晰提示），不卡死。
4. WHEN `/reasoning` THEN 仍可单独改 effort（不动模型）。
5. WHEN 切换后 THEN 后续 LLM 调用用新 model + effort（state→runTurn→provider→reasoning.effort）。
6. 防闪沿用 diff renderer；clean-room；fake 测试不烧订阅；typecheck/test/build/pack 全绿；pack 仍 3 文件。

## 涉及文件（修改）
- `src/provider/models.ts` — AVAILABLE_MODELS 改为对齐 pi 的列表
- `src/tui/app.tsx` / `src/tui/commands.ts` — `/model` 选完链式进 effort 选择
- `src/tui/components/OptionSelector.tsx` — 如需支持两步链式
- `test/` — 模型清单内容、/model→effort 链式、Esc 语义、/reasoning 单独入口 覆盖

## 发布
self-merge 到 dev 后作为 **0.0.6** 发布（发布动作由项目所有者执行）。
> 注：列表对齐 pi，但真实订阅可调通性仍需 ByAnDa 实测；如某模型 404 再从常量裁剪。
