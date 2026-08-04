# 人与通信
最后更新：2026-07-24 by @kaleidLead

## 角色表
| 角色 | 谁 | 干什么 |
|---|---|---|
| Owner / 决策 / 发布 | @ByAnDa | TALK、STAGE(a)、ACCEPT、G5 migration / 不可逆 gate、npm publish |
| Lead（暂代 PM） | @kaleidLead | PRD/spec、QUEUE/SEND/WATCH/VERIFY、发布提请、handover 保鲜 |
| PM | 无独立角色 | 当前由 @kaleidLead 暂代；产品拍板仍归 @ByAnDa |
| Multica squad | `kaleid` | 唯一代码实施主体：Owner+Coder+双 QA |
| Architect | @Architect | cluster SOP/治理；疑问走 DM |

## Multica 两个 UUID
- **project UUID**：`a89d8382-7a05-4811-9c46-f3078c845023`
- **squad UUID**（`issue create` assignee）：`95fb20f1-b137-462f-88f9-9bc29d85f153`
- **Owner agent UUID**（stall 唤醒）：`bba96477-6b59-4add-a50c-e3e4042abfae`
- 唯一合法唤醒格式：`[@kaleid Owner](mention://agent/bba96477-6b59-4add-a50c-e3e4042abfae)`
- 🔴 纯文本 `@kaleid Owner` 不可靠；改状态/重新 assign 不会唤醒已派任务；`rerun` 禁用。

## Slock 频道
🔴 本节及下方「找谁」表默认读者 A（有 raft 身份）。读者 B 没有对外出口——所有「DM @X」= 说给正在跟你对话的人，由她转达。先读 `README.md` §0。
- **#kaleid-spec**：项目需求、审核、派单与验收主频道。
- #Architect：广播/任务回执；治理疑问 DM @Architect，不在频道展开。
- #all：永久静默。
- 项目决策优先在 #kaleid-spec 留痕；敏感凭证绝不进公共频道。

## Escalation
| 情况 | 动作 |
|---|---|
| 无 agent 且无 Owner brief | issue 评论用 mention-link 唤醒，继续 recurring WATCH |
| 有 brief、未落 dev、卡在人 | 不唤醒 squad；向对应人收敛最小决策，日级跟进 |
| squad 越权 publish/bump/tag 或未 self-merge | 不代做；先 mention-link Owner，仍不动则报 @ByAnDa |
| migration | **跑起来既有行会被读或写 ⇒ gate；判不准也 gate**（不由实施者自解释）；完整免除条件与例子见 `ByAnDa/bylaws/norms/spec-authoring.md` §6 |
| 其它不可逆/公开发布/凭证风险 | 直接走 @ByAnDa gate |
| SOP/治理疑问 | DM @Architect |
| 产品/设计优先级 | @ByAnDa；本项目无独立 PM，产品裁决权始终在 ByAnDa |
