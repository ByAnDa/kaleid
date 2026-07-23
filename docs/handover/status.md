# 当前状态
最后更新：2026-07-23 by @kaleidLead

## 版本
- 当前已发布：**kaleid 0.0.16**（npm `latest`，2026-07-23 复核）。
- 代码层 HEAD：**`f017eae`**（最后一个非 docs-only commit；发布链 0.0.16 bump）。最后功能 commit：**`7da0524`**（spec-025）。
- dev 可能因 PRD/spec/handover 文档 commit 领先于代码层；是否需要发布只比较代码层 HEAD，不把 docs-only commit 算落后。
- staging：**N/A**。kaleid 是本地 CLI；对外运行态变化 = npm publish。

## 在飞
- 代码类：**无在飞 spec**；Multica kaleid 项目 19 个历史 issue 均为 done。
- docs 类：cluster handover rollout（Slock task #2，Architect 2026-07-23 下发）已落本目录，等待 Architect diff/冷读抽查。

## 队列（只列已获批准、可 SEND 的顺序）
- **空**。没有 ByAnDa 已批准且待派的代码 spec。

## 最近完成（3 个）
- spec-025 / BYW-139：v2 Phase A（StateChip、输入框强化、resume 筛选/预览、ToolCall 折叠）；功能 commit `7da0524`，随 0.0.16 发布。
- spec-024 / BYW-120：彩色 banner、输入框边距/填色、resume 筛选回归；`b94bb85`，随 0.0.15 发布。
- spec-023 / BYW-119：状态行、thinking 独行、留白、banner 结构；`80ebb60`，随 0.0.14 发布。

## 当前阻塞
- 无已批准队列的工程 blocker。
- spec-026（CI/持久化 TUI 门/bump 脚本）仍只是 Lead 提案，卡在 ByAnDa TALK；未批准，禁止先 SEND。
- v2 Phase B、≤62 列 resume 残留、真实 provider wire 冒烟均待 ByAnDa 定优先级/授权，详见 `redlines.md`。
