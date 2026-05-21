---
项目: kaleid
文档: spec-008 — REPL slash 命令（login/logout/exit 改为 /命令形式）
作者: kaleidLead
生成时间: 2026-05-22
Reviewer: ByAnDa
上游: PRD `kaleid PRD v0.3.md` F4 / 《跨项目 Spec 工作流规则 v1.5》
状态: 待实现
编号: spec-008
依赖: 已发布的 V1（spec-001~007，origin/dev）
---

# spec-008 — REPL slash 命令

> 编号：spec-008 / 模块：cli + tui / 依赖：V1 已实现（dev）/ 状态：⬜ 待实现
> 类型：post-V1 行为调整（CLI/TUI 交互方式变更），非新功能模块。

## 目标
把 login / logout / 退出 从「CLI 子命令 + REPL 文本」改为 **REPL 内 slash 命令**形式（ByAnDa msg=4a0038ef）。

## 用户故事
用户在 REPL 里用 `/login` `/logout` `/exit` `/help` 管理会话，像 Claude Code 那样；普通文字仍直接发给 agent。

## 变更详述

### 1. REPL 输入解析（核心）
- REPL 一行输入：**以 `/` 开头 → 当作 slash 命令**；否则 → 当作 prompt 发给 agent（走现有 runTurn）。
- 解析：取首 token（`/cmd`），匹配命令表；命令可带参数（V1 命令暂不需要参数）。
- slash 命令的执行与反馈**在 TUI 内处理/显示，不发给 LLM**、不进会话 messages。

### 2. 命令表
| 命令 | 行为 |
|---|---|
| `/login` | 触发 OAuth 登录流（复用现有 `auth/oauth.ts` login）。已登录则提示"已登录为 <account>"，可重新登录。完成后写 `~/.kaleid/auth.json`。|
| `/logout` | 删除 `~/.kaleid/auth.json`，TUI 提示已登出。后续需 `/login` 再用。|
| `/exit` | 退出 REPL（**替代原先输入 `exit`/`quit`**）。等价于原退出逻辑（清理 + 进程退出）。|
| `/help` | 在 TUI 列出可用 slash 命令及说明。|
| 未知 `/xxx` | TUI 提示 `unknown command: /xxx`，并提示 `/help`。不发给 LLM。|

### 3. 移除顶层 CLI 子命令
- **移除** `kaleid login` 和 `kaleid logout` 顶层子命令（`cli/args.ts` 去掉对应分支）。
- `kaleid`（无参）→ 仍进 REPL；REPL **可在未登录状态启动**，用户用 `/login` 登录后再发任务。
- `kaleid "<prompt>"`（one-shot）→ 若未登录，stdout/stderr 提示「请先运行 `kaleid` 并执行 `/login` 登录」并 exit 1（one-shot 本身不做交互式登录）。
- `kaleid --help` / `--version` 保留。

### 3b. Slash 命令自动补全菜单（ByAnDa msg=12ca0b0a，必做）
- 当用户在 REPL 输入框**输入 `/`（且光标在命令位置，通常是行首）时，输入框下方实时显式列出所有可用命令**：`/login` `/logout` `/exit` `/help`（含一行简述）。
- **随输入实时匹配筛选**：继续输入字符（如 `/lo`）→ 菜单按命令名**前缀匹配**收窄（`/lo` → `/login` `/logout`）；无匹配则菜单提示无匹配。
- 交互：上下方向键在候选间移动 + 回车/Tab 补全选中项；Esc 关闭菜单；命令执行（回车提交命令）后菜单消失。
- 仅当输入以 `/` 开头时显示该菜单；普通 prompt 输入不显示。
- 实现：ink 组件（建议 `src/tui/components/SlashMenu.tsx`），数据源 = 命令表（与 §2 同一份，单一来源）；不发给 LLM。
- 防闪：菜单是动态区组件，遵循 spec-007 的 `<Static>` 原则（历史区不受影响）。

### 4. TUI 接线（spec-007 app.tsx）
- 输入提交时先判 slash：是命令 → 分派到命令处理（`/login` 走 OAuth 流，期间 TUI 显示引导/URL/粘贴提示；`/logout` 删凭证刷新提示；`/exit` 退出；`/help` 渲染命令列表），命令产物作为一条系统/提示消息进历史区（`<Static>`），不进 LLM messages。
- 非命令 → 原有 runTurn 流程不变。
- `/login` 的 OAuth 浏览器/回调/粘贴 fallback 复用 spec-002 现有实现（含 opener 缺失不崩溃、打印授权 URL、手动粘贴 code）。

## 实现要求
- 复用现有 `auth/oauth.ts`（login）、`token-store.ts`（logout = 删文件）；不新写 OAuth 逻辑。
- 命令分派建议独立小模块（如 `src/tui/commands.ts`）：`parseSlash(input)` + `runSlashCommand(name, ctx)`。
- 退出路径：`/exit` 与原 `exit`/`quit` 的清理逻辑一致；原 `exit`/`quit` 文本**不再特殊处理**（会被当普通 prompt 发给 agent，除非也想保留——默认按"改为 /exit"移除文本退出）。
- 保持 clean-room、测试用 fake（slash 解析 + 命令分派可单测；`/login` 的 OAuth 仍用 fake endpoint，不烧真实订阅）。

## 验收标准
1. WHEN REPL 输入 `/help` THEN TUI 列出 `/login //logout //exit //help` 及说明，不发给 LLM。
2. WHEN 输入 `/login` THEN 触发 OAuth 登录流（浏览器/打印 URL/粘贴 fallback），成功后写 `~/.kaleid/auth.json` 并提示已登录。
3. WHEN 输入 `/logout` THEN 删除 `~/.kaleid/auth.json` 并提示已登出。
4. WHEN 输入 `/exit` THEN 干净退出 REPL（替代原 `exit`/`quit`）。
5. WHEN 输入普通文字（不以 `/` 开头）THEN 照常作为 prompt 发给 agent。
6. WHEN 输入未知 `/xxx` THEN 提示 unknown command + `/help`，不发给 LLM、不崩溃。
6b. WHEN 输入框输入 `/` THEN 下方实时列出全部可用命令（/login //logout //exit //help + 简述）。
6c. WHEN 在 `/` 后继续输入（如 `/lo`）THEN 菜单按前缀实时筛选（→ /login //logout）；方向键选择 + 回车/Tab 补全；Esc 关闭。
6d. WHEN 输入不以 `/` 开头 THEN 不显示命令菜单。
7. WHEN 执行 `kaleid login` 或 `kaleid logout`（旧子命令）THEN 不再存在（应报未知命令 / usage），登录改走 REPL `/login`。
8. WHEN 未登录执行 `kaleid "task"`（one-shot）THEN 提示先运行 `kaleid` + `/login` 并 exit 1。
9. 全部自测用 fake，不消耗真实订阅额度；typecheck/test/build 全绿；`npm pack` 内容不变（仍只 README+dist+package.json）。

## 涉及文件（修改）
- `src/cli/args.ts` — 移除 login/logout 子命令分支
- `src/tui/app.tsx` — 输入 slash 判定 + 命令分派接线 + 挂 SlashMenu
- `src/tui/commands.ts`（新建，建议）— slash 解析 + 命令处理 + 命令表（单一来源）
- `src/tui/components/SlashMenu.tsx`（新建）— 输入 `/` 时的命令补全菜单（实时前缀筛选 + 方向键/回车/Tab/Esc）
- `src/modes/repl.ts` — 如有需要传入命令上下文
- `src/modes/one-shot.ts` — 未登录提示文案调整（指向 REPL /login）
- `auth/oauth.ts` / `token-store.ts` — 复用，不改逻辑
- `test/` — 加 slash 解析/分派 + one-shot 未登录提示覆盖

## 发布
实施完成 self-merge 到 dev 后，作为 **kaleid 0.0.2** 发布（`npm version patch` → `npm publish --access public`，由 ByAnDa 跑）。
