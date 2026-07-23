# 设计源地图
最后更新：2026-07-23 by @kaleidLead

## Canonical 设计源
| 页面/模块 | 正本位置 | 版本锚（固定 commit hash） |
|---|---|---|
| v2 全屏 TUI 布局/交互 | `design/kaleid/project/tui-screens.jsx` + `design/kaleid/chats/chat1.md` + `screenshots/{01-v2-multi,02-v2-multi,v2-chats,v2-overview,v2-streaming}.png` | **`84d513c`**（2026-05-26） |
| Daylight / Spectrum token、state/mode palette | `design/kaleid/project/kaleid-tokens.js` | **`84d513c`** |
| v1 palette/基础视觉参考 | `design/kaleid/project/screenshots/{kaleid-final,tokens-dark-mid,tokens-light}.png` | **`5ab8ad1`**；只作 palette/历史基础参考，布局不得覆盖 v2 |

> DESIGN 步确认新版后，立刻把对应行更新为新设计文件的最后 commit。取值：`git log origin/dev -1 --format=%h -- "<路径>"`。

## 🔴 Confusable 排除表
| 禁引用 | 为什么像正本 | 处置 |
|---|---|---|
| 5ab8ad1 的 `canvas-overview.png` / `kaleid-final.png` 作为完整现行布局 | 与现行 bundle 同目录、配色仍像当前 | 仅 palette/历史对照；现行 v2 布局看 84d513c |
| 外部 Claude Design fetch URL / `/tmp/kaleid-design*` 解包目录 | 是设计上游且文件名相同 | 上游/临时缓存，不是正本；repo 固定 hash 才是 |
| spec/Multica issue 中嵌入的用户截图 | 看起来最贴近某次 bug | 只作缺陷证据，不作完整视觉基准 |
| `uploads/` 私图 | 曾是上游设计输入 | 明确排除，不得进公开 repo |
| HTML/JS prototype 的内部组件结构 | 可直接复制，看似省事 | 只还原视觉意图；生产栈是 Ink，禁止照搬 prototype 结构 |

## 取用方法
- 先 `git fetch origin dev`，再对每行运行 `git log origin/dev -1 --format=%h -- "<路径>"`；必须与版本锚一致。
- 视觉层以本表 canonical 文件为准；产品文字/范围以 `docs/prd/core.md` 为准；某 spec 若明确覆盖旧设计选择，以该已批准 spec 为准。
- 终端不可表达 shadow/px/字号/真圆角时按 PRD/decision 的近似规则实现，不得为了“像设计”制造假能力。
- 新设计：ByAnDa/Lead 确认 → 去私密 uploads → 合入 `design/kaleid/` → 更新本表固定 hash → 再写/派 spec。
