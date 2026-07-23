# 流程
最后更新：2026-07-24 by @kaleidLead

## 规范正本 = github.com/ByAnDa/bylaws
- 写 spec：`norms/spec-authoring.md`（🔴 A2 冲突分层 + G5 migration 默认 gate 已生效）。
- 派单/盯单：`norms/multica-cli.md` + `norms/dispatch-brief.md`。
- 端口/DB：`norms/ports-and-db.md`（起新服务先查）。
- 全流程：`sop/carve-ship.md`；clone 不了时以本文件其余摘要作业。

`ByAnDa/bylaws` 是规范/SOP/教训的唯一正本；本文件只保留 kaleid
可离线作业的流程摘要。两者冲突时以 bylaws 为准。

## 通用流程摘要（bylaws 不可达时也能独立作业）
- **CARVE**：TALK → PRD → DESIGN → SPLIT → CHECK → QUEUE。
- **SHIP**：PICK → SEND → WATCH → VERIFY → STAGE → ACCEPT。
- ByAnDa 触点只有 TALK、STAGE(a)、ACCEPT 与 G5 migration / 其它不可逆高危 gate。
- SEND 后立刻挂 `--repeat every:20m` reminder；WATCH 四态回查：
  1. 实施已落 dev → VERIFY；
  2. agent 仍在跑 → 继续 recurring 监控；
  3. 无 agent、无 Owner brief → 用 `roles.md` mention-link 唤醒 Owner，催过后收紧为 10m；
  4. 有 brief、无 agent、未落 dev、卡在人 → 不唤醒 squad，向人压缩为最小决策+默认选项，改日级跟进。
- VERIFY 必须实测 `origin/dev`，不凭 brief。STAGE(a) 必须主动提请 ByAnDa，不自动发也不默默等。
- 权威全文：`ByAnDa/bylaws/sop/carve-ship.md`；仓库不可达时按本文件摘要作业，治理疑问 DM @Architect。

## 派单前唯一防线
- 先确认 PRD/设计/spec 三角对齐，ByAnDa 已审 spec；没过 CHECK 不 SEND。
- A2 冲突分层：文字/业务逻辑/状态流转以 PRD 为准，视觉/布局/交互形态以设计图为准；跨层真冲突打回 PM 三角对齐，实施方不得自行择一。
- G5 migration 决策内核：**跑起来既有行会被读或写 ⇒ gate；判不准也 gate**（不由实施者自解释）；完整免除条件与例子见 `ByAnDa/bylaws/norms/spec-authoring.md` §6。
- spec 内每道门必须写齐：**谁闭合 / 可执行方式与判过标准 / 输出贴回 issue**。
- DoD 说“证明 X 能工作”时必须明确证据是实环境还是允许替身；未写即不算定义完成。
- squad 无能力闭合的门不得放进 self-merge 硬前置；上移 Lead VERIFY 或 ByAnDa ACCEPT。
- Owner brief 出现降级披露 = VERIFY 红灯；必须由有能力角色补闭合并贴输出。
- 破坏性验证要减少/收紧被测能力，让断言确实变红；输出必须贴回 issue。

## 本项目差异
- kaleid 无独立 PM，Lead 暂代 PRD/SPLIT；标准顺序固定为：ByAnDa TALK → Lead 更新 `docs/prd/` → TUI 项走 DESIGN（纯逻辑项显式 N/A）→ Lead SPLIT spec → ByAnDa CHECK → Lead QUEUE/PICK → 才能 SEND。
- squad 从 `dev` 切 `feature/spec-<NNN>-<slug>`，双 QA 后 self-merge 回 dev；Lead 不代合。
- 本项目不开实施 PR；当前维护机无 `gh`。实施是否落 dev 用 `git fetch origin dev && git log origin/dev` 验真。
- **无 staging**：STAGE(a) = 提请 npm publish 时机，附变更面+风险面。ByAnDa 点头后也仍由她自己发布。
- **当前无 CI**：不能把“no checks”说成双绿。替代机械门 = 双 QA + Lead clean checkout 手跑 typecheck/test/build/pack + dev HEAD 实测；真实输出贴 issue。
- TUI 视觉/交互硬门优先写可重复文本帧断言；真实 TTY 肉眼验收只作 ByAnDa ACCEPT 软 gate。
- provider fake 测试只证明内部 wire 假设自洽；真实 provider 冒烟是独立、需凭证授权的门。

## 本项目 spec 惯例
- 路径：`specs/kaleid-v1-spec.md`（001~007）与 `specs/spec-<NNN>-<slug>.md`（008+）；索引见 `specs/README.md`。
- label：`kaleid-spec-<NNN>`，紫色 `#8b5cf6`，避免 workspace 跨项目同名串色。
- 每个 issue 正文必须包含 pi 参考 URL <https://github.com/earendil-works/pi>；禁止放 Claude Code 泄露仓库链接。
- 每个 issue 正文必须写死：feature 分支、self-merge dev、禁 publish/tag/release/version bump、版本未经 ByAnDa 不升 `0.x`、pack 3 文件边界。

## 保鲜规则
| 时机 | 更新 |
|---|---|
| VERIFY / publish 提请 / publish 完成 | `status.md` |
| TALK/PRD 新结论 | `docs/prd/` 正本版本+日期 bump，并更新索引 |
| DESIGN 定版 | `design-map.md` 固定 hash |
| ByAnDa 拍新决策 | `decisions.md` |
| 新红线/复发坑 | `redlines.md` |
