---
项目: kaleid
文档: 核心 PRD
版本: v0.5a
日期: 2026-07-23
作者: "@kaleidLead（暂代 PM）"
Reviewer: "@ByAnDa"
状态: "现行；0.0.16 已发布，后续范围须重新 TALK/CHECK"
对应设计稿版本: "design/kaleid @ 84d513c（v2 TUI）；纯逻辑模块 N/A"
---

# kaleid PRD v0.5a — 终端编码 Agent

## 变更日志
- **v0.5a（2026-07-23）**：Architect 全量冷读后的事实修正：Node 24 明确为维护机特定基线；版本字面量由 stale“三处”纠正为现行两处。
- **v0.5（2026-07-23）**：迁入 `docs/prd/` 唯一正本；把 spec-015~025 的已交付能力与 0.0.16 发布事实并入；纠正旧稿“待审核/进行中”状态；补设计固定锚与证据边界。
- v0.4（2026-05-22~26）：把 spec-008~025 逐次写回，但文件头版本未随内容更新（本次修正）。
- v0.3（2026-05-22）：V1 定稿，provider 锁 Codex OAuth + gpt-5.5。
- v0.2（2026-05-21~22）：锁定 clean-room、Ink、持久化与 provider 路线。
- v0.1（2026-05-21）：初稿。

## 1. 产品定位
kaleid 是一个**极简终端编码 Agent（harness）**：接入 OpenAI Codex OAuth、DeepSeek、Kimi，给模型 read/write/edit/bash 工具，在共享 agent loop 中执行多步编码任务，并通过全屏 Ink TUI 与 one-shot CLI 交互。

目标用户首先是 ByAnDa，也允许公众从 npm 安装。产品保持小内核、明确扩展点和 clean-room 实现，不追求一次复制 Claude Code/Codex 的全部能力。

## 2. 产品原则
1. **clean-room**：可借鉴 pi 等项目的公开架构模式，不复制第三方代码。
2. **最小内核 + 可扩展**：provider、Tool、agent loop、session、TUI token 都有单一扩展点。
3. **真实能力驱动 UI**：backend 没有的数据/状态不先画空壳。
4. **终端原生**：键盘优先；不假装支持 px、字号、shadow、鼠标优先交互。
5. **本地优先**：凭证、API key、会话只保存在用户机器。
6. **发布克制**：0.0.x 小步迭代；owner 独占 npm publish。

## 3. 当前范围（0.0.16）

### 3.1 Provider 与认证
- `LLMProvider` 抽象统一流式文本、tool call 与错误。
- OpenAI Codex：ChatGPT OAuth（PKCE、本地 `:1455` 回调、refresh、account id），Responses API。
- DeepSeek：OpenAI-compatible API key；支持动态 `/models` 与 reasoning content。
- Kimi coding：OpenAI-compatible API key，固定 coding model。
- `/login` 选择 provider；`/model` 只展示已认证 provider 的模型。
- reasoning effort 仅对 Codex 模型显示；不把 DeepSeek/Kimi 假装成同一参数模型。

### 3.2 工具与 agent loop
- 四个工具：read / write / edit / bash，统一 Tool 接口和 zod schema。
- bash 必须经过唯一 `executeBash()` chokepoint，集中处理超时、进程组与输出截断。
- user → provider → tool calls → 结果回灌 → 继续，直到无 tool call 或达到保护上限。
- system prompt 固定内置，不提供任意 `--system-prompt` 覆盖。

### 3.3 CLI 与会话
- `kaleid` 进入交互 TUI；`kaleid "<prompt>"` / `-p` 走 one-shot。
- `--continue` 恢复最近会话；`--resume [id]` 恢复/选择会话。
- 会话 JSONL 持久化；显示 context token/window/%；支持自动压缩与 `/compact`。
- `/rename`、`/project`、`/chatlabel` 维护对话名称、项目与多标签。
- `/resume` 支持 project/label 筛选、会话只读预览与恢复。

### 3.4 全屏 TUI
- Daylight / Spectrum 双主题，默认跟随终端；truecolor 并提供 256/16 色降级。
- 自研 TTY diff renderer 避免每帧整屏 clear。
- 对话顶部开始；角色细 gutter、消息间隔、彩色 welcome banner。
- 输入框支持多行、行号、prompt sigil、hint bar；状态/上下文信息保持单行与右对齐。
- StateChip 只展示现有真实状态。
- tool call 默认折叠，可用键盘展开完整输出。
- resume 在足够宽的终端显示只读 preview pane；窄屏降级为列表。

### 3.5 打包与分发
- TypeScript + Node（package engine >=22；Node 24 是维护机 BYANDA-Home 特定验证基线，不是额外产品门槛）。
- esbuild 打成单文件 `dist/index.js`，npm bin 为 `kaleid`。
- 包为 `UNLICENSED`，不带 LICENSE 文件。
- `npm pack` 边界固定 3 文件：README、dist/index.js、package.json。

## 4. Slash 命令
| 命令 | 需求 |
|---|---|
| `/login` / `/logout` | 登录 provider / 清除 provider 凭证 |
| `/model` / `/reasoning` | 选择模型 / Codex 推理强度 |
| `/compact` | 手动压缩当前上下文 |
| `/resume` | 选择并恢复持久化会话 |
| `/rename` / `/project` / `/chatlabel` | 管理会话名称、项目和标签 |
| `/theme` | 切换主题 |
| `/help` / `/exit` | 帮助 / 退出 |

## 5. 非目标与 Phase B
以下能力**尚未批准实施**，不得当作当前产品承诺：
- reasoning 内容流式展示；
- approval 门与 NORMAL/PLAN/AUTO/READ-ONLY autonomy；
- `@files` 附件；
- plan card / subagent；
- 会话 fork/delete；
- 全文搜索与 date 筛选；
- 鼠标优先交互；
- 服务器部署、数据库、团队账号系统。

## 6. 关键产品决策
| 决策 | 结论 |
|---|---|
| provider | Codex OAuth + DeepSeek + Kimi；接口可扩展 |
| runtime | TypeScript + Node ESM |
| TUI | Ink + 自研 diff renderer |
| shell | 直接执行，但必须单 chokepoint |
| persistence | OAuth/API key + JSONL 会话本地持久化 |
| system prompt | 固定内置 |
| license | UNLICENSED，无 LICENSE 文件 |
| 发布 | npm public；ByAnDa 独占 publish；版本默认仅 0.0.x |

## 7. 验收与证据边界
当前通用机械门：
```bash
npm run typecheck
npm test
npm run build
npm pack --dry-run
```

- 测试基线：41 tests（2026-07-23）。
- pack 必须仍是 3 文件。
- TUI 改动优先用 ink 文本帧断言覆盖宽度/ANSI/折叠展开。
- 🔴 fake OAuth/SSE/provider 测试只证明内部实现与 fixture 自洽，**不证明真实 provider wire 可用**。
- 真实 provider 冒烟需要用户凭证与明确授权，作为独立门记录，不得用 41/41 替代。
- 当前无 CI；双 QA 与 Lead 本地门必须贴真实输出，不能把 “no checks” 说成 CI 绿。

## 8. 版本与 spec 追溯
| 版本 | 主要内容 | spec |
|---|---|---|
| 0.0.1 | V1：Codex OAuth、4 工具、loop、REPL/one-shot、基础 TUI、npm | 001~007 |
| 0.0.2 | slash 命令与补全 | 008 |
| 0.0.3 | `/login` TUI 回调/粘贴修复 | 009 |
| 0.0.4 | 全屏 TUI + diff renderer | 010 |
| 0.0.5 | model/reasoning 选择器 | 011 |
| 0.0.6（dev-only） | 模型清单与链式 effort | 012 |
| 0.0.7（dev-only） | DeepSeek/Kimi、多 provider 登录 | 013 |
| 0.0.8 | 汇总 012~014 后发布：多 provider + token/compaction/JSONL/resume | 012~014 |
| 0.0.9 | provider/system/slash bugfix | 015 |
| 0.0.10 | rename + project/name metadata | 016 |
| 0.0.11 | project/label combobox、resume 筛选、命令无参交互 | 017~019 |
| 0.0.12 | 双主题、真实设计 token/配色 | 020~021 |
| 0.0.13 | 对话布局、细 gutter、多行输入/状态行 | 022 |
| 0.0.14 | 状态行、thinking 独行、banner 结构 | 023 |
| 0.0.15 | 彩色 banner、输入框边距、resume 筛选回归 | 024 |
| 0.0.16 | v2 Phase A：StateChip、输入框强化、筛选/预览、ToolCall 折叠 | 025 |

> npm 未单独发布 0.0.6 / 0.0.7；两步实现随 0.0.8 一起公开。发布事实用 `npm view kaleid versions --json` 核对。

## 9. 风险与待确认
- Codex OAuth 用 ChatGPT 订阅存在政策/endpoint 稳定性风险；ByAnDa 已知情接受。
- Anthropic 禁止第三方用 Claude 订阅 OAuth；未来接 Claude 只能官方 API key。
- 真实 wire 未形成可重复自动门；当前“可用”更多依赖 ByAnDa 日常实用探针。
- resume <=62 列仍可能塌缩；是否修由 ByAnDa 排期。
- version 字面量当前有两处硬编码（`package.json` + `WelcomeBanner.VERSION_LABEL`）；是否做 spec-026 由 ByAnDa 决定。
- Phase B 的范围与顺序尚未拍板。

## 维护
- PM/Spec owner：@kaleidLead（暂代）
- 最终产品与发布：@ByAnDa
- 设计固定锚：`docs/handover/design-map.md`
- 实施契约索引：`specs/README.md`
