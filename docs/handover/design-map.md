# 设计源地图
最后更新：2026-07-23 by @kaleidLead

## Canonical 设计源

| 页面/模块 | 类型 | 正本位置 | 版本锚（固定 commit hash） | 最后取用与可得性 |
|---|---|---|---|---|
| v2 全屏 TUI 布局/交互 | **设计源** | `design/kaleid/project/tui-screens.jsx` + `design/kaleid/project/app.jsx` + `design/kaleid/project/kaleid-tokens.js` + `design/kaleid/chats/chat1.md` | **`84d513cf047c86d04460fe436baf58b709664f96`**（2026-05-26） | Claude Design v2（handle `jPDLksXgmsJK_ChO_iMmKg`）最后抓取 **2026-05-26**；现已无授权、不可再取，repo 最后抓取副本即正本 |
| v2 设计意图（含 V1→V2 过程与完整 tool payload） | **设计源** | `design/kaleid/chats/design-chat-kaleid-a60aadc1.json` + 同目录 `README.md` | **`db089bbb3c0532f4f7ca1af5dcc1c591322cb799`** | Claude 账号导出日 **2026-07-20**，提取/最后取用 **2026-07-23**；原设计服务已不可再取，这是已知唯一完整 raw chat 副本 |
| v2 状态/布局渲染图 | **渲染产物** | `design/reference/{01-v2-multi,02-v2-multi,v2-chats,v2-overview,v2-streaming}.png` | **`db089bbb3c0532f4f7ca1af5dcc1c591322cb799`**（仅迁路径；内容源自 `84d513c`） | 最后外部取用 **2026-05-26**；源已不可再取，图只作视觉证据，不能替代 JSX/JS 设计源 |
| v1 Daylight/Spectrum 源文件 | **历史设计源** | `design/archive/claude-design-v1/` | **`db089bbb3c0532f4f7ca1af5dcc1c591322cb799`**（逐字节恢复自 `5ab8ad17f824e80b4245c94e76ea67e0f466c330`） | Claude Design v1（handles `ZFnrpDJM0m6jKOS5hSEL_w` / `7R9y9p_0wI7IBLFalb-SFA`）最后抓取 **2026-05-22**；现已无授权、不可再取 |
| v1 palette / 基础视觉参考 | **渲染产物** | `design/reference/{kaleid-final,tokens-dark-mid,tokens-light,canvas-overview}.png` | **`db089bbb3c0532f4f7ca1af5dcc1c591322cb799`**（仅迁路径；内容源自 `5ab8ad1`） | 最后外部取用 **2026-05-22**；只作 palette/历史基础参考。**例外：已批准的 `specs/spec-025-v2-phase-a.md` §3 明确引用 `kaleid-final.png` 的 resume 筛选栏排布，该局部可作现行依据；其余布局不得覆盖 v2** |
| spec-022 / spec-024 改版前状态 | **时刻资产 / before 证据** | `design/reference/baseline-spec-022-tui-layout.png` + `baseline-spec-024-{input,resume}.png` | **`db089bbb3c0532f4f7ca1af5dcc1c591322cb799`** | 原始 Raft 消息附件摄于 **2026-05-23**，最后取用/落仓 **2026-07-23**；只证明当时缺陷，不是现行设计目标 |
| pi model selector 对照 | **外部产品渲染参考** | `design/reference/baseline-spec-012-pi-model-selector.png` | **`db089bbb3c0532f4f7ca1af5dcc1c591322cb799`** | 原始 Raft 消息附件摄于 **2026-05-22**，最后取用/落仓 **2026-07-23**；只作 spec-012 对照，不是 kaleid canonical |
| Ink / readline 防闪选型 spike | **历史代码原型** | `design/prototypes/early-tui-comparison/` | **`db089bbb3c0532f4f7ca1af5dcc1c591322cb799`** | 单机目录最后取用 **2026-05-21**，P1 抢救日 **2026-07-23**；只证明早期技术探索，不得覆盖现行设计 |

> **设计源 ≠ 渲染产物。** HTML/JSX/JS 与完整 chat 可继续修改/追溯意图；
> `design/reference/` 只能看某次渲染或某时刻状态。若只剩 PNG、源码已失，
> 必须如实标“设计源灭失”，不得把截图冒充可编辑正本。

## 旧→新路径对照（2026-07-23）

历史 spec 是生成时快照，可能仍写旧路径；按本表解析，不回写冻结 spec。
保留逐项映射是为了让按旧名 grep 仍能证明迁移发生过。

| 旧路径 | 新路径 |
|---|---|
| `design/kaleid/project/screenshots/01-v2-multi.png` | `design/reference/01-v2-multi.png` |
| `design/kaleid/project/screenshots/02-v2-multi.png` | `design/reference/02-v2-multi.png` |
| `design/kaleid/project/screenshots/canvas-overview.png` | `design/reference/canvas-overview.png` |
| `design/kaleid/project/screenshots/kaleid-final.png` | `design/reference/kaleid-final.png` |
| `design/kaleid/project/screenshots/tokens-dark-mid.png` | `design/reference/tokens-dark-mid.png` |
| `design/kaleid/project/screenshots/tokens-light.png` | `design/reference/tokens-light.png` |
| `design/kaleid/project/screenshots/v2-chats.png` | `design/reference/v2-chats.png` |
| `design/kaleid/project/screenshots/v2-overview.png` | `design/reference/v2-overview.png` |
| `design/kaleid/project/screenshots/v2-streaming.png` | `design/reference/v2-streaming.png` |

## 2026-07-23 物理位置抢救盘点

| 物理位置 / 载体 | 结果 |
|---|---|
| repo 全 refs + Git 历史 | 只发现 v1 `5ab8ad1` 与 v2 `84d513c` 两轮外部 bundle；被 v2 覆写的 v1 源已从 Git 对象逐字节恢复到 `design/archive/` |
| Raft `#kaleid-spec` 消息/附件 | 找回 4 张从未落仓的 before/对照截图；找回账号导出中的 `project.name=kaleid` raw design chat（完整、不节选） |
| 本机工作目录 | 找回仅存在于 `~/kaleid-tui-demos/` 的 Ink/readline spike；`/tmp/kaleid-design*` 三轮临时 bundle 缓存现已不存在 |
| vault / Documents / Downloads / Desktop / Pictures | kaleid vault 只有历史 PRD/spec/研究文档；未发现额外设计源或图片副本 |
| Nutstore / OneDrive | 未发现 kaleid 设计文件副本 |
| Claude 账号导出 | 只接收元数据明确声明 `project.name=kaleid` 的 `design_chat`；`users.json` / `memories.json` / `conversations.json` 与原 zip 未访问、未复制、未入仓；chat 引用的私图二进制仍排除 |

盘点结论：P0 外部设计源的最后抓取副本、唯一 raw chat 与 P1 单机原型均已落仓；
能触达的位置没有第二份未保全的 kaleid 设计资产。此结论只覆盖本 Lead 可触达的物理位置
及已由持有人按 `project` 元数据分发的账号导出，不冒充全世界无其它副本。

## 🔴 Confusable 排除表

| 禁引用 | 为什么像正本 | 处置 |
|---|---|---|
| `design/archive/claude-design-v1/` 作为现行全屏布局 | 源码完整、可直接运行，看起来比截图更“真” | 历史源，只用于追溯 v1；现行 v2 看 `84d513c` |
| `kaleid-final.png` 作为完整现行布局 | 配色仍像当前，且与 v2 图同目录 | 仅 palette/历史对照；唯一局部例外 = spec-025 §3 已批准的 resume 筛选栏排布 |
| `v2-chats.png` 与 `v2-overview.png` 当作两个不同状态 | 文件名不同 | 两者 SHA-256 完全相同（`b22a5286…de042`），不能证明两个独立状态 |
| message baseline 图 | 看起来最贴近真实产品 | 只作当时缺陷/before 证据，不作完整视觉基准 |
| raw chat 里的中间 `write_file` 版本 | 含完整源码 payload，容易被当最终稿 | 用于意图/迭代追溯；最终 v2 文件以 bundle `84d513c` 为准 |
| 外部 Claude Design fetch URL / `/tmp/kaleid-design*` | 曾是设计上游且文件名相同 | 已不可再取/临时缓存已灭失；禁止再尝试拉取，repo 固定 hash 才是正本 |
| `uploads/` 私图 | 曾是上游设计输入，raw chat 仍有文件名/path 元数据 | ByAnDa 明确说实施无需参考；二进制不得进公开 repo |
| HTML/JS prototype 的内部组件结构 | 可直接复制，看似省事 | 只还原视觉意图；生产栈是 Ink，禁止照搬 prototype 结构 |

## 取用与保全方法

- 先 `git fetch origin dev`，再对每行运行
  `git log origin/dev -1 --format=%H -- "<路径>"`；必须与版本锚一致。
- 视觉层以本表 canonical 文件为准；产品文字/范围以 `docs/prd/core.md`
  为准；某 spec 若明确覆盖旧设计选择，以该已批准 spec 为准。
- 终端不可表达 shadow/px/字号/真圆角时按 PRD/decision 的近似规则实现，
  不得为了“像设计”制造假能力。
- 🔴 今后从任何外部设计服务取到源码、bundle、prompt 或 chat，**同一工作会话
  立刻 commit**；“我读过”不算保全。
- 🔴 现状截图 / baseline / before 属时刻资产，**改版动工前先落
  `design/reference/`**，否则改版本身会摧毁证据。
- 新设计：ByAnDa/Lead 确认 → 排除私密 uploads → 设计源与渲染图同时落仓
  → 更新本表固定 hash → 再写/派 spec。
