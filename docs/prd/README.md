# PRD 索引
最后更新：2026-07-23 by @kaleidLead

## 🔴 铁律
1. 本目录是 kaleid PRD 的唯一正本；聊天里定的不落这里 = 没定。
2. 内容一动，文件头的版本与日期必须 bump；git 史是变更史，文件头是人/AI 三角对版锚。
3. 新 PRD 文件头必填：版本、日期、作者、状态、对应设计稿版本。
4. PRD 定产品范围与口径；实施细节仍在 `specs/`。两者冲突先停，向 ByAnDa 收敛后再改正本。

PRD 维护权：kaleid 无独立 PM，由 @kaleidLead 暂代并直接维护本目录；ByAnDa 仍是最终 Reviewer。2026-07-23 起 vault PRD 停止更新。

## 现行
| PRD | 功能 | 对应设计稿版本 | 状态 |
|---|---|---|---|
| `core.md`（v0.5，2026-07-23） | 终端编码 Agent：provider、工具、loop、会话、全屏 TUI、npm 分发与演进 | `design/kaleid/` @ **`84d513c`**；纯逻辑模块 N/A | ✅ 现行；0.0.16 已发布，Phase B 未批准 |

## 已废弃（禁作依据）
| PRD | 被谁取代 | 废弃日期 |
|---|---|---|
| `docs/kaleid-prd-v0.4.md` 完整旧本 | `docs/prd/core.md` v0.5；旧路径只保留指针 | 2026-07-23 |
| vault `ByAnDa/kaleid/kaleid PRD v0.4.md` | `docs/prd/core.md` v0.5 | 2026-07-23 |
