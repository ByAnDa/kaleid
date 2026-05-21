---
项目: kaleid
文档: spec-011 — /model 模型选择器 + header 显示当前模型
作者: kaleidLead
生成时间: 2026-05-22
Reviewer: ByAnDa
上游: PRD `kaleid PRD v0.3.md` / spec-008(slash) / spec-010(全屏 TUI)
状态: 待实现
编号: spec-011
依赖: 已发布 0.0.4（dev，全屏 TUI）
类型: TUI 功能新增
---

# spec-011 — `/model` 模型选择器

> 触发：ByAnDa msg=71e08d31 —— 加 `/model` 命令列出所有可用模型（OpenAI OAuth），标注当前在用，上下箭头选择高亮，回车应用，右上角 header 显示当前模型名。

## 目标
REPL 内 `/model` 打开模型选择器，可视化切换当前会话使用的模型；header 右上角常显当前模型名。

## 变更详述

### 1. 可用模型清单（数据源）
- Codex OAuth（chatgpt 后端）无干净的"列模型"接口 → 用**可维护的常量清单**（建议放 `src/provider/models.ts`，导出 `AVAILABLE_MODELS: { id: string; label?: string }[]`）。
- 候选清单（实装时**对照真实 Codex 后端验证、只保留实际可调通的**，避免列出却 404）：
  - `gpt-5.5`（默认）、`gpt-5.5-pro`
  - Codex 系列：`gpt-5.2-codex`、`gpt-5.3-codex`、`gpt-5.1-codex`、`gpt-5-codex`（按真实可用裁剪）
- 默认模型仍 `gpt-5.5`；清单必须包含默认项。
- 单一来源：选择器、header、provider 默认都引这份清单/当前值。

### 2. `/model` 命令（slash）
- 在 slash 命令表（spec-008 `src/tui/commands.ts`）加入 `/model`：列出可用模型供选择。
- 触发后进入**模型选择器 overlay**（类似 slash 菜单的列表，但是选择态）。

### 3. 选择器交互
- 列出 `AVAILABLE_MODELS` 全部项，**当前在用的那个加标注**（如前缀 `●` / 后缀 `(current)`）。
- **上 / 下方向键**移动焦点；**焦点项高亮**（反色或显著配色）。
- **回车**：应用焦点模型为当前会话模型（后续 LLM 调用用新模型），关闭选择器，在对话区给一条系统提示 `已切换模型: <id>`。
- **Esc**：取消，不改当前模型，关闭选择器。
- 选择器期间普通输入/其它 slash 不生效（同 spec-009 粘贴模式的独占输入处理）。

### 3b. `/reasoning` 推理强度选择器（ByAnDa msg=b98b8be5 — API 支持，加上）
- Codex Responses API 支持 `reasoning.effort`，取值：`minimal` / `low` / `medium` / `high` / `xhigh`（API 另有 `none`，可选不暴露）。
- 加 slash 命令 **`/reasoning`**（或合理命名），打开与模型选择器**同款交互**的选择器：列出强度等级、标注当前、上下箭头高亮、回车应用、Esc 取消。
- 默认 `medium`；选中后当前会话立即生效，写入 provider 请求体 `reasoning: { effort: <选中> }`（参考 spec-003/pi 的 reasoning 字段）。
- 与模型选择器共用选择器组件（同一个 `ModelSelector` 泛化，或并列一个 `OptionSelector`）。

### 4. header 显示当前模型 + 推理强度（右上角）
- spec-010 的 Header（`src/tui/components/Header.tsx`）：左侧 `kaleid`，**右上角显示当前模型名 + 推理强度**（如 `gpt-5.5 · high`）。
- 切换模型或推理强度后 header 实时更新。
- 防闪：变更只 patch header 那一行（依赖 spec-010 的 diff renderer）。

### 5. 应用范围
- 选中**当前会话立即生效**（agent loop 后续调用用新 model）。
- 命令行 `--model <id>` 覆盖仍保留（启动时初值）。
- 持久化（重启记住所选）：**可选/加分**，可写入 `~/.kaleid/config.json`（V1 不强制）。

## 验收标准
1. WHEN 输入 `/model` THEN 弹出模型选择器，列出全部可用模型，当前在用项有明确标注。
2. WHEN 上/下方向键 THEN 焦点在候选间移动，焦点项高亮。
3. WHEN 回车 THEN 应用焦点模型为当前会话模型，关闭选择器，对话区提示已切换，后续 AI 调用使用新模型。
4. WHEN Esc THEN 取消、当前模型不变、关闭选择器。
5. WHEN 切换模型后 THEN header 右上角实时显示新模型名。
6. WHEN 选择器打开时 THEN 普通输入/其它 slash 不被误触发。
7. WHEN header 显示 THEN 始终可见当前模型名 + 推理强度（含启动初值 gpt-5.5 · medium 或 --model 指定值）。
8. WHEN 输入 `/reasoning` THEN 弹出推理强度选择器（minimal/low/medium/high/xhigh），标注当前、箭头高亮、回车应用、Esc 取消；应用后写入请求体 reasoning.effort 且 header 更新。
9. 防闪：选择器开关/切换只 patch 变化行，不整屏闪（沿用 spec-010 diff renderer）。
10. clean-room；测试用 fake；typecheck/test/build/pack 全绿；`npm pack` 仍只 README+dist+package.json。

## 涉及文件（修改/新增）
- `src/provider/models.ts`（新建，建议）— `AVAILABLE_MODELS` 常量 + 默认模型 + `REASONING_LEVELS`（minimal/low/medium/high/xhigh）+ 默认 medium，单一来源
- `src/tui/commands.ts` — slash 表加 `/model` + `/reasoning`
- `src/tui/components/ModelSelector.tsx`（新建，泛化为通用选择器或单列两个）— 列表 + 高亮 + 键盘交互（模型 + 推理强度共用）
- `src/tui/app.tsx` — `/model` `/reasoning` 进选择器子状态、应用所选、对话区提示
- `src/tui/components/Header.tsx` — 右上角当前模型名 + 推理强度
- provider/loop — 当前 model + reasoningEffort 作为可变会话状态（runTurn / 请求体用当前值）
- `test/` — /model + /reasoning 列表/高亮/应用/Esc/header 更新 覆盖

## 发布
self-merge 到 dev 后作为 **0.0.5** 发布（发布动作由项目所有者执行）。
