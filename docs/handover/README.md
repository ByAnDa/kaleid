# kaleid Handover
最后更新：2026-07-24 by @kaleidLead

> 本文件夹用于让一个零背景的新 AI 对话只靠 `docs/handover/`、`docs/prd/` 与其中的验新仪式接手 kaleid。
> `ONBOARDING.md` 是稳定事实层；本文件夹是鲜活判断层。两者冲突时以本文件夹为准。

## 0. 你是谁、你不许做什么（先读再动手）
- 你接手的角色：**kaleid Lead（暂代 PM）**。职责是把 ByAnDa 的需求沉淀进 PRD/spec、派 Multica squad、WATCH、VERIFY，并提请发布；Lead 不代写实施代码。
- 🔴 权限边界：
  - 不修改 Multica 任务状态；done 转换归 ByAnDa/squad。`rerun` 禁用。
  - 不停止、暂缓、取消任何已派 issue；发现问题只能让当前 issue 跑完，再 fix-forward。
  - 项目内 spec 严格串行：一次一个，前一个 VERIFY 通过才 SEND 下一个。
  - 不自行 merge squad 的实现；无代码的 PRD/spec/handover 由 Lead 维护。实现未落 dev 时用 `roles.md` 的 mention-link 催 Owner。
  - 不自行 `npm publish`。kaleid 无 staging，STAGE(a) 的等价物是向 ByAnDa 提请 publish 时机，并附变更面与风险面。
  - 凡 migration 碰到既有数据/列/约束，默认先过 ByAnDa gate；除非 spec 明写“纯新增（只加表/加列，不动旧的）”且 PM 核实才免。其它不可逆操作与会影响用户凭证/公开发布的高风险改变也必须先过 gate。
  - 未经 ByAnDa 授权不做 version bump；Multica 永远不得 publish/tag/release/version bump。

## 1. 仓库与前置工具
- repo：<https://github.com/ByAnDa/kaleid>｜本地约定路径：`~/repos/kaleid`；不存在时从 GitHub clone。
- 默认开发分支：`dev`。`main` 不是开发真值；发布也从 `dev` 进行。
- Multica worktree 位于 `~/multica_workspaces/`，不要把其临时 agent 分支当 dev 真值。
- 🔴 验新需要完整历史；浅 clone 先 `git fetch --unshallow`。

| 工具 | 验证命令 | 备注 |
|---|---|---|
| git | `git -C ~/repos/kaleid status --short --branch` | dev 真值用 `origin/dev` |
| Node/npm | `node --version && npm --version` | package 要求 Node >=22；Node 24 仅是维护机 **BYANDA-Home 特定**现状，换机重查 |
| multica CLI | `multica issue list --project a89d8382-7a05-4811-9c46-f3078c845023` | 派单/盯单；项目 UUID 固定 |
| raft CLI | `raft profile show` | Slock 通信 |
| gh CLI | `command -v gh` | 未安装仅是维护机 **BYANDA-Home 特定**现状；换机重查。无 gh 时用 git 远端命令等价验真 |

## 2. 读序
`status.md` → `project.md` → `process.md` → `roles.md` → `redlines.md` → `decisions.md` → `design-map.md` → `../prd/README.md`

## 3. 验新仪式（读 PRD/设计前必跑）
```bash
cd ~/repos/kaleid
git fetch origin dev
git log origin/dev -1 --format="%ci %h" -- docs/prd/
git log origin/dev -1 --format="%ci %h" -- design/kaleid/project/kaleid-tokens.js
git log origin/dev -1 --format="%ci %h" -- design/kaleid/project/tui-screens.jsx
git log origin/dev --oneline -- ':!docs' ':!specs' ':!*.md' | head -1
npm view kaleid version
```

三角对版：
1. `docs/prd/core.md` 文件头的 PRD 版本与「对应设计稿版本」；
2. `design-map.md` 的固定 commit hash；
3. `origin/dev` 上对应文件的实际最后 commit。

🔴 任一对不上就停止，向 ByAnDa 收敛差异；不得自行挑一个当真。

## 4. 信任层级
- 信 `origin/dev` 实测，不信 Owner brief；brief 可能先于 push。
- issue 状态可能 stale，不作为完成依据；实施 commit 真落 dev 才算。
- npm 是否发布以 `npm view kaleid version` 为准，不以聊天里的发布计划为准。
- 绿灯只回答更窄的问题：当前 41 个测试主要证明 fake/mock 下的内部契约，不证明真实 provider wire 可用。
- 支持结论的空结果最危险；先做控制组证明检查真的跑起来。
- 本文件夹引用的 Slock msg id / BYW-xxx 在无 Slock/Multica 凭证环境不可核验，这是“不复制动态真值”的有意结果；拿到权限后回查。

## 5. 第一天 checklist
- [ ] `npm ci && npm run typecheck && npm test && npm run build` 全绿；当前基线 41 tests。
- [ ] `node dist/index.js --version` 与 `package.json` 一致，证明发布 bundle 真能加载。
- [ ] `npm pack --dry-run` 仍仅包含 `README.md`、`dist/index.js`、`package.json`。
- [ ] 读最近 3 个 spec：025 / 024 / 023，并回查 BYW-139 / 120 / 119。
- [ ] 跑 §3 验新仪式，核对 PRD、设计与 dev。
- [ ] 用自己的话 DM ByAnDa 复述当前状态；发出后不空等，按 `status.md` 的已批准队列工作。

## 6. 存量自述层处置（2026-07-23 盘点）
| 旧入口 | 处置 |
|---|---|
| `CLAUDE.md` / `AGENTS.md` | repo 当日机械扫描确认不存在；不要假定有自动加载规则 |
| `README.md` | 保留为公众安装/使用说明，已按 0.0.16 能力校正 |
| `ONBOARDING.md` | 稳定事实层；顶部指向本文件夹，动态状态改为指针 |
| `design/kaleid/README.md` | 保留为设计导出包阅读说明；顶部补 handover/design-map 正本指针 |
| `docs/kaleid-prd-v0.4.md` | 只保留废弃指针；正本迁至 `docs/prd/core.md` v0.5a |
| `specs/` | `specs/README.md` 为索引；spec 正文仍是实施契约 |
| vault `ByAnDa/kaleid/*.md` | PRD/spec 副本已标历史/废弃；此后不再维护，repo 为唯一正本 |
