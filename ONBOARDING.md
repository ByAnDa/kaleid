# ONBOARDING — kaleid 终端编码 Agent CLI

> 项目导航门户（单一入口）。第一次接触 / 久未开工 / 交接 / Multica per-task context，读这一份就知道"一切在哪、怎么开工"。
> 标准：《项目 Onboarding 文件标准 v1》（`<KB>/项目 Onboarding 文件标准 v1.md`）。维护者：Lead @kaleidLead。
> 原则：index + bootstrap（核心 inline，详情外链，不重复 PRD/技术栈/spec 全文）。
> `<KB>` = `/mnt/c/Users/Administrator/Documents/ByAnDa/技术经验共享/`（BYANDA-Home 挂载；同一 Syncthing vault 在别机可能是 `/mnt/d/Obsidian/ByAnDa/技术经验共享/`）。

---

## 0. 一句话简介

kaleid 是 **clean-room 自研的终端编码 Agent CLI**（TS + Node + ink TUI），ByAnDa 自用 → 已公开发布到 npm（`npm i -g kaleid`）。接 OpenAI Codex OAuth（ChatGPT 订阅，默认 gpt-5.5）+ DeepSeek + Kimi，提供 read/write/edit/bash 4 工具 + agent loop + 单/多轮记忆。差异化 = **极简 clean-room 内核 + 防闪全屏 ink TUI + 多 provider**，借鉴 pi / Claude Code 的设计模式但不复制代码。

---

## 1. 📍 位置索引（核心）

### ① 项目代码位置
- **本地 repo**：`~/repos/kaleid`（运行机 = BYANDA-Home，用户 ubuntuadministrator）
- **GitHub**：`https://github.com/ByAnDa/kaleid`（默认开发分支 `dev` = Mode A trunk；发布时 owner 从 dev publish）
- **关键目录 map**（`src/`，TS + ESM）：
  - `src/provider/` — **LLMProvider 抽象**（`types.ts` 接口 + `registry.ts` 路由）+ `openai-codex.ts`（Codex OAuth Responses API）+ `openai-compat.ts`（DeepSeek/Kimi，OpenAI 兼容 /chat/completions）+ `models.ts`（模型表/effort）+ `responses-encode.ts` / `responses-sse.ts`（原生 fetch+SSE 自写）
  - `src/auth/` — Codex OAuth（`oauth.ts` + `pkce.ts` + `callback-server.ts`（本地 :1455）+ `constants.ts`）+ `token-store.ts`（OAuth token 持久化）+ `config-store.ts`（API key 持久化）
  - `src/tools/` — 4 工具 `read.ts` / `write.ts` / `edit.ts` / `bash.ts`（+ `bash-executor.ts` 单 chokepoint + `truncate.ts` 输出治理 + `path-utils.ts` + `index.ts` 注册）
  - `src/loop/` — `agent-loop.ts`（任务→LLM→调工具→回灌循环）+ `session.ts` / `session-store.ts`（jsonl 持久化 + resume）+ `compaction.ts`（自动压缩）+ `system-prompt.ts`（system prompt）+ `types.ts`
  - `src/modes/` — `repl.ts`（交互）+ `one-shot.ts`（单次/print）
  - `src/tui/` — `app.tsx`（ink 主组件）+ `components/`（Header/Conversation/Message/ToolCall/InputBar/MultilineInput/StatusLine/StateChip/ResumeSelector/WelcomeBanner/OptionSelector/OptionCombobox/SlashMenu/Badges 等）+ `theme/`（tokens + daylight/spectrum 双主题 + detect/fallback 降级）+ `terminal.ts`（防闪 diff renderer）
  - `src/cli/` — `args.ts` / `run.ts` / `index.ts`（参数解析 + 入口）；`src/index.ts` = bin 入口
  - `design/kaleid/` — Claude Design v2 bundle（token + tui-screens + screenshots，供 spec 实施参考；**私有 uploads 已排除、不入 repo**）

### ② 项目文档位置（repo 内 + vault）
- **PRD**：repo `docs/kaleid-prd-v0.4.md`（= vault `<VAULT>/kaleid/kaleid PRD v0.4.md`，Syncthing 同步）。§八 列 spec-008~025 演进、§九 多 provider、版本路线表。
- **specs**：`~/repos/kaleid/specs/`（`kaleid-v1-spec.md` + `spec-008-*.md` ~ `spec-025-*.md`，kaleidLead 自起；vault 同名副本在 `<VAULT>/kaleid/`）
- **README**：`~/repos/kaleid/README.md`（仓库门面 / npm 包说明）
- **CLAUDE.md / AGENTS.md**：⚠️ **本 repo 暂无**（kaleid 是小型自研 CLI，约定都在本 onboarding + spec + PRD；如需可后补）
- **对比研究 doc（在 vault，非 repo）**：`<VAULT>/kaleid/kaleid V1 vs pi 详细对比.md` + `kaleid V1 vs Claude Code 详细对比.md`（clean-room 借鉴依据；CC 那份是泄露源码，仅本地学习参考，**公开 repo/README 不留链接**）
- `<VAULT>` = `/mnt/c/Users/Administrator/Documents/ByAnDa/`（同 §0 的 vault）

### ③ 涉及 kaleid 的「技术经验共享」KB 文档（`<KB>/` 下）
- 《工程开发总流程 v1.md》— 9 阶段 macro 流程（kaleid 是纯 CLI 工具，**Stage 3 设计/部署相关段对 CLI 多为 N/A**，见 §1⑤）
- 《跨项目 Spec 工作流规则 v1.5.md》— spec 编号 / 5 项必问 / 工作流红线
- 《Multica CLI 基础操作 v1.md》— Multica 操作 + cluster 红线 §11.7-§11.14
- 《项目 Onboarding 文件标准 v1.md》— 本文件依据的标准
- 《Claude Design 协作工作流 v1.md》— kaleid TUI 用了 Claude Design bundle（spec-020~025），相关
- 其余（《跨项目部署规划 v1》《集群环境端口与资源总表 v1》《本地开发环境端口与 DB 约定 v1》）**对 kaleid 基本 N/A**（CLI 工具，无 web 端口 / 无 DB / 无 ECS 部署）

### ④ 所有协作流程
- **kaleid 轻流程**（ByAnDa 拍板，CLI 工具无独立 PM，Lead 暂代 PM）：**ByAnDa 说修改 → kaleidLead 写 spec + 补进 PRD → 发 ByAnDa 审核 → 通过 → 派 Multica kaleid squad → squad 在 `feature/spec-<NNN>-<slug>` 分支实施 + 双 QA 交叉 + self-merge 回 dev → kaleidLead 按 §11.12 独立终审 → ByAnDa 发布（npm publish）**。
- **9 阶段 macro**（链《工程开发总流程 v1》）：CLI 无 web UI → Stage 3（设计）对纯逻辑 spec 跳过；TUI 类 spec 用 Claude Design bundle。
- **Multica squad**：`kaleid` squad UUID **`95fb20f1-b137-462f-88f9-9bc29d85f153`**（派单只派 squad）。Project ID **`a89d8382-7a05-4811-9c46-f3078c845023`**。
- **给 Multica 的硬规范**（每个 issue 正文必带）：① 开发分支 `feature/spec-<NNN>-<slug>`（从 dev 切，self-merge 回 dev，禁 `agent/<role>/<hash>` 名）② **只实施，禁 publish/tag/release/version bump**（发布是 owner 独有动作）③ 版本只增 `0.0.xx`，未经 ByAnDa 同意禁升 `0.x` ④ clean-room（不抄 pi/Claude Code 代码）⑤ pack 仍 3 文件（README + dist/index.js + package.json）。
- **标签**：每个 issue 打 spec 编号标签；⚠️ Multica 标签按名跨项目共享，kaleid 用 **`kaleid-spec-<NNN>`**（紫 `#8b5cf6`）前缀避免与别项目串色。
- **Gate**：双 QA 交叉验证 → kaleidLead §11.12 终审（读全部评论 + clean checkout dev 跑 typecheck/test/build/pack + 验 DoD）→ ByAnDa 发布。

### ⑤ 各环境 + 部署信息（CLI 工具，多数 N/A）
- **local dev**：TS + Node 24（ESM）。`npm run dev`（tsx 直跑）或 `npm run build && npm start`。**无 web 端口 / 无 DB**；状态纯内存 + 持久化到 `~/.kaleid/`（见 §1⑥）。OAuth 回调临时占本地 `:1455`。
- **"部署" = npm publish**：CLI 装机分发，不是部署服务。owner 在 dev 上 `npm publish --access public` → `npm i -g kaleid`。`latest` 当前 **0.0.15**（0.0.16 待发，见 §7）。
- **staging / prod ECS**：**N/A**（CLI 工具，无服务器部署）。
- **provider 后端**（外部 SaaS，非我们部署）：Codex `chatgpt.com/backend-api/codex/responses`（OAuth client_id `app_EMoamEEZ73f0CkXaXp7hrann`，回调 `:1455`）/ DeepSeek `api.deepseek.com` / Kimi `api.kimi.com/coding/v1`。

### ⑥ 🔴 代码目录外的环境/测试相关文件位置（最关键，最易丢）
- **构建 / 打包配置**：
  - `esbuild.config.mjs`（单文件 bundle → `dist/index.js`；ink/React JSX/TSX 经此构建）
  - `package.json`：`bin.kaleid = dist/index.js`、`files = ["dist/"]`（只发 dist）、`license = "UNLICENSED"`（**无 LICENSE 文件，ByAnDa 拍板**）、`prepublishOnly = build + typecheck`、`publishConfig.access = public`
  - `tsconfig.json`（tsc --noEmit 类型检查）
- **运行态用户数据 / secrets（在 `~/.kaleid/`，非 repo）**：
  - `~/.kaleid/auth.json` — **Codex OAuth token**（env 覆盖 `KALEID_AUTH_FILE`）
  - `~/.kaleid/config.json` — **provider API key**（DeepSeek/Kimi，`0o600`；env 覆盖 `KALEID_CONFIG_FILE`）
  - `~/.kaleid/sessions/*.jsonl` — 会话持久化（resume 来源；env 覆盖 `KALEID_SESSIONS_DIR`）
  - **认证政策红线**：Claude 只能走官方 API key（Anthropic 禁第三方用订阅 OAuth）；Codex OAuth 同属灰色地带，ByAnDa 知情接受。绝不做 Claude 订阅 OAuth。
- **provider 抽象接入点**：`src/provider/types.ts`（LLMProvider 接口）+ `registry.ts`（按模型路由 codex-oauth / openai-compat）—— 加 provider 从这里。
- **system prompt**：`src/loop/system-prompt.ts`（agent 的 system prompt 在此，非散落）。
- **测试**：`test/*.test.ts`（`npm test` = `tsx --test test/*.test.ts`，全 fake/mock：fake SSE / fake OAuth / temp dir 工具）。当前 41 测试。**无 `.github/` CI**（无 in-repo CI workflow，靠本地 + Multica squad 自测/双 QA）。⚠️ **真实后端未端到端验证**（QA/review 都用 fake，没用真实 ChatGPT/DeepSeek/Kimi 在线跑通 wire）。

---

## 2. 技术栈速查

| 层 | 技术 |
|---|---|
| 语言 / 运行时 | TypeScript + Node.js 24（ESM） |
| TUI | ink（React-for-CLI）+ 自研防闪 diff renderer（`src/tui/terminal.ts`）+ 双主题 token 系统 |
| LLM 接入 | 原生 `fetch` + SSE 自写（**无官方 SDK**）；Codex OAuth Responses API / DeepSeek / Kimi（OpenAI 兼容） |
| 校验 | zod（schema） |
| 构建 | esbuild（单文件 bundle）；tsx（dev / test runner）；tsc（typecheck） |
| 分发 | npm（`npm i -g kaleid`，bin `kaleid`） |

详见 PRD（§1②）+ vs pi / vs Claude Code 对比 doc。

## 3. 本地 5 分钟起步

```bash
git clone https://github.com/ByAnDa/kaleid.git ~/repos/kaleid && cd ~/repos/kaleid
npm install
npm run build && npm run typecheck && npm test   # 全绿（test 41）
# 跑起来（交互 REPL TUI）
npm start            # 或 npm run dev（tsx 直跑源码）
# 首次用 /login 登录 provider（Codex OAuth 会开浏览器 + 本地 :1455 回调；或 DeepSeek/Kimi 粘贴 API key）
# 单次模式：  node dist/index.js -p "你的任务"     （one-shot，不进 TUI）
# 打包校验：  npm pack --dry-run                    （应只 3 文件：README + dist/index.js + package.json）
```
> 无需 DB / 无需起服务；用户数据落在 `~/.kaleid/`（见 §1⑥）。

## 4. 协作模式 + 红线

- **模式**：Mode A + Multica `kaleid` squad（`95fb20f1-...`）。轻流程见 §1④。
- **kaleid 项目特定红线**：
  - **clean-room 自研**：借鉴 pi（MIT）/ Claude Code（泄露源码）的设计模式，**禁止复制其代码**；公开 repo / README **不留 Claude Code 泄露源链接**（仅 pi MIT 链接可留）。
  - **bash 单 chokepoint**：所有命令执行走 `src/tools/bash-executor.ts`，不散落。
  - **provider 认证**：绝不做 Claude 订阅 OAuth（违反 Anthropic ToS）；Codex OAuth 灰色地带 ByAnDa 知情接受。
  - **给 Multica**：只实施、禁 publish/tag/version bump；版本只增 `0.0.xx`（未经 ByAnDa 禁升 minor）；feature 分支 + self-merge；pack 恒 3 文件。
  - **TUI**：颜色全走 theme 单一来源；防闪沿用 diff renderer；px/字号/圆角 token 不适用（终端忽略）。
- **cluster 通用红线**：链《Multica CLI 基础操作 v1》§11.7-§11.14 + 《工程开发总流程 v1》。

## 5. 关键人 / agent

| 角色 | 谁 | 备注 |
|---|---|---|
| Lead（暂代 PM）| @kaleidLead | kaleid 负责人 + 调度 + spec/PRD + 终审（本 onboarding 维护者）；跑 BYANDA-Home |
| Multica Owner | kaleid Owner `bba96477-6b59-4add-a50c-e3e4042abfae` | squad 派发中枢 |
| Multica Coder | `1b03f5f7-d046-481a-8b89-668505e7e2bc` | 实现 |
| Multica QA | `be6bc251-c448-40f0-90f1-1f68dfa910b4` | Gate / 交叉验证 |
| Multica QA（Ivana）| `d4cfaf88-5bd7-455f-b49f-811bd2829055` | 双 QA 交叉验证 |
| Architect | @Architect | cluster 架构 / 标准 / 治理 |
| 拍板 / 发布 | @ByAnDa（member `d9e2bfd7-5957-4a68-b655-1d08c0c7a6e2`）| 最终验收 + npm publish |

## 6. 当前状态快照（动态，更新于 2026-05-27）

- **V1 内核已完成**：provider 接入（Codex OAuth + DeepSeek + Kimi）/ 4 工具（read/write/edit/bash）/ agent loop / 单对话记忆（token 显示 + 自动压缩 + jsonl 持久化 + resume）/ 全屏 ink TUI / npm 打包发布。
- **已发布**：npm `latest` = **0.0.15**（spec-008~024：slash 命令 / 全屏 TUI / 模型·推理选择器 / 多 provider / 记忆 / rename·project·label / resume 筛选 / Daylight·Spectrum 双主题 + 真实设计配色 + TUI 布局精修）。
- **dev = 0.0.16**（spec-025 v2 Phase A：状态 pill / 输入框强化 / resume 筛选自适应 / tool 折叠卡 / resume 只读预览侧栏）已终审通过、已 bump，**待 owner 发布**（见 §7）。
- **实时态** → Multica board（kaleid squad `95fb20f1`）。

## 7. 待办 / 阻塞 / 待决策（动态）

- 🔴 **0.0.16 待发**：owner 机 npm token 过期（`npm whoami` 401）→ publish E404。需 `npm login`（owner 账号 `byandakaleid`）后再 `npm publish --access public`。
- **resume 筛选 ≤62 列残留**：极窄终端（≤~62 列）筛选栏仍会塌缩（w≥70 已正常）；待 ByAnDa 确认是否开小后续收口。
- **v2 设计 Phase B 待排**：reasoning 流式展示 / approval 门 + autonomy 模式（NORMAL/PLAN/AUTO/READ-ONLY）/ @附件 / 会话 fork / 全文搜索·date 筛选 / subagent —— 依赖新 backend 能力，按 ByAnDa 优先级逐个立项。
- **技术债**：版本号硬编码 3 处（package.json + `WelcomeBanner.tsx` VERSION_LABEL + test 正则）应改从 package.json 注入。
- ⚠️ **真实后端未端到端验证**（§1⑥）：建议某次用真实 provider 在线跑通 wire 验证。
- 实时 blocker / 待 ByAnDa 拍项 → #kaleid-spec + Multica board。
