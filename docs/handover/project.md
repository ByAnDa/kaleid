# 项目事实
最后更新：2026-07-23 by @kaleidLead

## 一句话定位
kaleid 是一个公开发布到 npm 的极简终端编码 Agent：多 provider、read/write/edit/bash 工具、agent loop、持久化会话与全屏 Ink TUI。

## 栈与结构
- TypeScript + Node.js（ESM；package 要求 >=22；Node 24 是维护机 BYANDA-Home 特定验证基线）；Ink/React TUI；zod 校验；esbuild 单文件 bundle。
- `src/provider/`：Codex OAuth Responses API + DeepSeek/Kimi OpenAI-compatible 路由。
- `src/auth/`：OAuth、token 与 API-key 本地持久化。
- `src/tools/`：read/write/edit/bash；bash 统一经过 `bash-executor.ts`。
- `src/loop/`：agent loop、session JSONL、compaction、system prompt。
- `src/tui/`：全屏 UI、主题、resume、diff renderer。
- `design/kaleid/`：repo 内设计正本；`specs/`：逐次实施契约。

## 跑起来
| 动作 | 命令 | 验证“能用”的方法 |
|---|---|---|
| 安装依赖 | `npm ci` | lockfile 完整安装，无新增未审依赖 |
| 机械门 | `npm run typecheck && npm test && npm run build` | 当前基线 41 tests；build 生成 `dist/index.js` |
| bundle 真加载 | `node dist/index.js --version && node dist/index.js --help` | 输出版本/帮助，不是只检查文件存在 |
| 交互 TUI | `npm start` | 在真实 TTY 打开全屏界面；不要在无 TTY 的 squad 门里要求肉眼验收 |
| 打包边界 | `npm pack --dry-run` | 仅 3 文件：README、dist/index.js、package.json |
| 真实 provider 冒烟 | 需获授权后用 `/login` 再跑最小任务 | 现有测试不覆盖真实 wire；凭证门见下节 |

## 环境地图
| 环境 | URL/位置 | 方式 | 权属 |
|---|---|---|---|
| local dev | `~/repos/kaleid`；用户态 `~/.kaleid/` | `npm run dev` / `npm start` | Lead 可做本地验证 |
| npm public | <https://www.npmjs.com/package/kaleid> | owner 从 dev `npm publish --access public` | 🔴 STAGE(a) 先提请 ByAnDa；只有 ByAnDa 发布 |
| staging / ECS / DB | N/A | 无服务、无数据库 | N/A |
| provider SaaS | ChatGPT Codex / DeepSeek / Kimi | 用户自己的 OAuth/API key | 外部服务，不由本项目部署 |

## 🔴 Secrets 指针（密钥绝不写在这里）
| 需要什么 | 在哪 | 拿不到找谁 |
|---|---|---|
| Codex OAuth token | `~/.kaleid/auth.json`（可由 `KALEID_AUTH_FILE` 覆盖） | @ByAnDa；不得擅读/转发现有用户 token |
| DeepSeek/Kimi API key | `~/.kaleid/config.json`（可由 `KALEID_CONFIG_FILE` 覆盖） | @ByAnDa；或测试者自己的 key |
| 会话 JSONL | `~/.kaleid/sessions/`（可由 `KALEID_SESSIONS_DIR` 覆盖） | 属用户数据，不当作 fixture 上传 |
| npm 发布凭证 | owner 机器的 npm 登录态/token | @ByAnDa；Lead/squad 不持有也不代发 |

## 域名词表
- **provider wire**：对外 API 的真实 endpoint/header/SSE/JSON 契约；fake fixture 只证明内部假设自洽。
- **发布**：`npm publish`，等价于其它项目的 deployment。
- **Phase A / Phase B**：v2 UI 的可由现有数据驱动部分 / 需要新增 backend 能力部分。
- **文本帧门**：用 `ink-testing-library` 对不同终端宽度和 ANSI 输出做可重复断言，替代 squad 无法闭合的“肉眼真实终端”硬门。
