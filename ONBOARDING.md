# ONBOARDING — kaleid 终端编码 Agent CLI

> 稳定事实层。**接手 Lead 工作从 `docs/handover/README.md` 开始**；动态状态、红线或决策与本文冲突时，以 `docs/handover/` 为准。
> PRD 唯一正本在 `docs/prd/`；旧 vault/旧 `docs/kaleid-prd-v0.4.md` 只作历史。
> 维护者：@kaleidLead。

## 0. 一句话简介
kaleid 是 clean-room 自研的终端编码 Agent CLI（TypeScript + Node + Ink），公开发布到 npm。它接入 OpenAI Codex OAuth、DeepSeek 与 Kimi，为模型提供 read/write/edit/bash 工具、agent loop、持久化会话和全屏 TUI。

## 1. 位置索引

### 代码
- 本地约定：`~/repos/kaleid`
- GitHub：<https://github.com/ByAnDa/kaleid>
- 开发真值：`dev` 分支
- npm：<https://www.npmjs.com/package/kaleid>

### 文档
- 接手入口：`docs/handover/README.md`
- PRD 唯一正本/索引：`docs/prd/core.md` / `docs/prd/README.md`
- spec：`specs/README.md` → `specs/*.md`
- 设计：`docs/handover/design-map.md` → `design/kaleid/`
- 公众使用说明：`README.md`
- `CLAUDE.md` / `AGENTS.md`：截至 2026-07-23 repo 不存在；不要假定有自动加载规则。

### 关键目录
- `src/provider/`：provider 接口、模型表、Codex Responses、DeepSeek/Kimi compatible。
- `src/auth/`：OAuth、token/API-key 存储。
- `src/tools/`：read/write/edit/bash 与 bash 单 chokepoint。
- `src/loop/`：agent loop、session、compaction、system prompt。
- `src/modes/`：REPL / one-shot。
- `src/tui/`：全屏 Ink UI、组件、主题、diff renderer。
- `test/`：单测；当前主要使用 fake/mock，不证明真实 provider wire。

## 2. 技术栈
| 层 | 技术 |
|---|---|
| 语言/runtime | TypeScript + Node.js（ESM；package engine >=22，维护基线 Node 24） |
| TUI | Ink + React + 自研终端 diff renderer |
| LLM | 原生 fetch/SSE；Codex OAuth Responses / DeepSeek/Kimi compatible |
| schema | zod |
| build/test | esbuild / tsc / tsx test runner |
| 分发 | npm public，bin `kaleid` |

## 3. 五分钟起步
```bash
git clone https://github.com/ByAnDa/kaleid.git ~/repos/kaleid
cd ~/repos/kaleid
git checkout dev
npm ci
npm run typecheck
npm test
npm run build
node dist/index.js --version
npm pack --dry-run
```

验收：
- build 产出 `dist/index.js` 且 CLI 真能输出版本/帮助；
- tests 当前基线见 `docs/handover/status.md`；
- pack 只含 README、dist/index.js、package.json。

交互启动：
```bash
npm start
```
首次使用在 TUI 内 `/login`。不要擅读或转发维护机已有 `~/.kaleid` 凭证。

## 4. 环境与分发
- 无 web 服务、无 DB、无 ECS、无 staging。
- OAuth 回调临时监听本机 `:1455`。
- 用户态数据：`~/.kaleid/auth.json`、`config.json`、`sessions/*.jsonl`。
- “部署”= `npm publish --access public`，只能由 ByAnDa 在 STAGE(a) 点头后执行。
- npm 当前版本是动态事实；用 `npm view kaleid version` 查，不在本文硬编码。

## 5. 协作模式
- ByAnDa 提需求 → Lead 更新 PRD/spec → ByAnDa CHECK → Multica kaleid squad 实施 → 双 QA/self-merge dev → Lead VERIFY → 提请 publish → ByAnDa ACCEPT/发布。
- 详细流程、WATCH 四态、权限边界与项目差异：`docs/handover/process.md`。
- 角色/UUID/mention-link：`docs/handover/roles.md`。
- 红线/已知坑/待拍项：`docs/handover/redlines.md`。

## 6. 代码目录外的关键位置
- Codex OAuth token：`~/.kaleid/auth.json`（可用 `KALEID_AUTH_FILE` 覆盖）。
- DeepSeek/Kimi key：`~/.kaleid/config.json`（可用 `KALEID_CONFIG_FILE` 覆盖）。
- session：`~/.kaleid/sessions/`（可用 `KALEID_SESSIONS_DIR` 覆盖）。
- build：`esbuild.config.mjs`、`tsconfig.json`、`package.json`。
- system prompt：`src/loop/system-prompt.ts`。
- provider 扩展点：`src/provider/types.ts` + `registry.ts`。

## 7. 动态状态
本文不维护版本/在飞/队列/阻塞副本。统一读取：
- `docs/handover/status.md`
- Multica kaleid project board
- `origin/dev`
- `npm view kaleid version`
