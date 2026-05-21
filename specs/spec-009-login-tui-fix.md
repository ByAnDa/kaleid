---
项目: kaleid
文档: spec-009 — 修复 REPL `/login` 在 TUI 下无反馈/无法登录
作者: kaleidLead
生成时间: 2026-05-22
Reviewer: ByAnDa
上游: PRD `kaleid PRD v0.3.md` F4 / spec-002(OAuth) / spec-007(TUI) / spec-008(slash)
状态: 待实现
编号: spec-009
依赖: 已发布的 0.0.2（dev）
类型: Bugfix（真实端到端使用暴露）
---

# spec-009 — 修复 REPL `/login` 在 TUI 下无反馈/卡死

> 触发：ByAnDa 实测 0.0.2，REPL 输入 `/login` 后一直显示 `running /login…`、无浏览器、无 URL、无成功提示（msg=0496725d）。

## 根因
`/login`（spec-008）在 ink TUI 内执行 `auth/oauth.ts` 的 `login()`，但 `login()`：
- 仅在浏览器打开失败时把授权 URL `stdout.write(...)`；ink 接管了 stdout → **URL 不显示**（即使失败也被 ink 清屏吞掉）。
- 用 `readline` 读 `stdin` 拿手动粘贴的 code；ink 接管 stdin（raw mode）→ **粘贴通道失效**。
- 整个 `login()` 是单个 await；slash 处理只在它 resolve 后才返回 messages → 期间 TUI 只剩 `running /login…`，且因无法粘贴/无回调，promise 实际永远挂着。

## 目标（ByAnDa 预期）
REPL `/login`：自动开浏览器 + **在 TUI 内显示授权 URL（始终显示，供手动复制）** + 提供 TUI 粘贴 code/回调 URL 的入口 + 登录成功显示「登录成功: <账号>」、失败显示错误。

## 变更详述

### 1. 给 OAuth login 加事件回调（auth/oauth.ts）
扩展 `OAuthOptions`（或新增 `login` 的回调参数），让调用方（TUI）能拿到流程事件，而不是写 stdout / 读 stdin：
- `onAuthUrl(url: string)`：拿到授权 URL 时回调（**无论浏览器是否打开都回调**）。
- `onStatus(msg: string)`：阶段提示（如「已打开浏览器，等待授权回调…」「正在换取令牌…」）。
- `getManualCode?(): Promise<string>`：可选，调用方提供"拿用户粘贴的 code/回调 URL"的 promise，与本地回调服务器竞速（先到先用）。
- 兼容：不传回调时维持现有 stdout/readline 行为（CLI/one-shot 不受影响）。
- `login()` 内部：`onAuthUrl(authorizeUrl)` 应**在开浏览器之后立即调用**（始终），不要只在失败分支；readline 路径仅在未提供 `getManualCode` 时使用。

### 2. TUI `/login` 接线（tui/commands.ts + app.tsx）
- `/login` 进入"登录进行中"子状态（busy，但与普通 turn 区分）。
- 传入 `login` 的回调：
  - `onAuthUrl(url)` → 在历史区渲染一条消息：`请在浏览器完成授权（已尝试自动打开）。如未打开，手动复制此链接：\n<url>`（URL 单独成行，便于复制）。
  - `onStatus(msg)` → 更新动态状态行。
  - `getManualCode` → **把输入框切到"粘贴模式"**：提示 `粘贴 OAuth code 或回调 URL，回车提交`；用户在 ink 输入框输入 → resolve 该 promise（喂给 OAuth 流）。粘贴模式下输入**不**当 prompt/slash。
- 成功：`login()` resolve → `save(creds)` → 历史区显示 `登录成功: <accountId>`，退出登录子状态、恢复正常输入。
- 失败/取消：显示错误消息（如端口占用、token 交换失败、用户取消），恢复正常输入，不崩溃。
- 全程**不向 process.stdout 写**（避免污染 ink 渲染）。

### 3. 不回归
- CLI 已无 `kaleid login`（spec-008 移除），登录只在 REPL `/login` —— 所以 TUI 路径必须可用。
- one-shot 未登录仍提示先 `kaleid` + `/login`（不变）。

## 验收标准
1. WHEN REPL 输入 `/login` THEN 立即在界面显示授权 URL（始终显示，可复制），并尝试自动打开浏览器；状态行显示"等待授权…"，**不再卡在无反馈的 running**。
2. WHEN 浏览器完成授权、本地回调拿到 code THEN 自动换取令牌、保存凭证、显示 `登录成功: <账号>`。
3. WHEN 浏览器无法用 / 用户手动复制 THEN 可在 TUI 粘贴框输入 code 或回调 URL，回车后完成登录并显示成功。
4. WHEN 登录失败/取消 THEN 显示明确错误，恢复正常输入，进程不崩。
5. WHEN 登录中 THEN 普通文字/其它 slash 不被误当 prompt（粘贴模式只接 code）。
6. clean-room；测试用 fake（onAuthUrl/getManualCode/exchange 全 mock，不连真实后端、不烧订阅）；typecheck/test/build 全绿；`npm pack` 仍只 README+dist+package.json。

## 涉及文件（修改）
- `src/auth/oauth.ts` — 加 onAuthUrl/onStatus/getManualCode 回调；始终 onAuthUrl；保留无回调时的旧行为
- `src/tui/commands.ts` — `/login` 走回调式登录，串接 TUI 粘贴
- `src/tui/app.tsx` — 登录子状态、URL/状态/成功渲染、输入框粘贴模式
- `test/` — 加 TUI `/login` 回调流 + 粘贴 + 成功/失败覆盖

## 发布
self-merge 到 dev 后作为 **0.0.3** 发布（发布动作由项目所有者执行）。
