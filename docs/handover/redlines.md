# 红线与已知坑
最后更新：2026-07-24 by @kaleidLead

## 🔴 本项目红线
- **clean-room**：可借鉴 pi 的公开模式；不得复制第三方代码。Claude Code 泄露源码只曾作本地研究，公开 repo/spec/issue 禁留其仓库链接。
- 公开 repo 的设计 bundle **不得包含 ByAnDa 私有 uploads/微信图**；只保留设计输出、token、chat 与允许公开的截图。
- **G5 migration 决策内核**：**跑起来既有行会被读或写 ⇒ gate；判不准也 gate**（不由实施者自解释）；完整免除条件与例子见 `ByAnDa/bylaws/norms/spec-authoring.md` §6。
- squad 只实施：必须 `feature/spec-*` → self-merge dev；禁止 publish/tag/release/version bump。
- 版本只增 `0.0.xx`；未经 ByAnDa 明确同意禁止升 `0.x`。Lead 的发布链 bump 窄例外尚未获明确背书。
- 所有 shell 执行必须走 `src/tools/bash-executor.ts` 单 chokepoint。
- TUI 颜色必须走 theme/token 单一来源；防闪不得绕开 `src/tui/terminal.ts` diff renderer。
- npm pack 必须保持 3 文件边界：README、dist/index.js、package.json。
- 认证政策：Claude 若接入只能用官方 API key；不得做 Claude 订阅 OAuth。Codex OAuth 的政策/稳定性风险由 ByAnDa 知情接受。
- Phase B 能力（plan/approval/autonomy/reasoning 流/@files/fork/search/subagent）未实现前，不得先画空壳 UI。
- 当前无 CI；不得把 `no checks`、双 QA brief 或 41/41 fake tests单独描述成真实后端/真实 TTY“全绿”。

## 已知坑
- **真实 provider wire 零覆盖**：曾把生产 endpoint 改成无效域名，41/41 仍全绿；fake server/parser 只证明同一套假设自洽。
- **resume 极窄宽残留**：w>=70 文本帧已通过；约 <=62 列仍可能整行塌缩。不得宣称“所有宽度已修”。
- **TUI 死门**：squad 无交互 TTY；写“真实终端肉眼复现”为 self-merge 前置会变死门/空门。用 ink 文本帧门，肉眼上移 ACCEPT。
- **文本帧判据也会错**：ANSI 可能是 256 色 `38;5` 而非 truecolor `38;2`；先 dump 控制组，再断言颜色。
- **版本号当前硬编码两处**：`package.json` 的 `version`、`src/tui/components/WelcomeBanner.tsx` 的 `VERSION_LABEL`。2026-07-23 实查 `test/` 已无现行版本字面量（仅有无关 fixture `0.0.1`）；漏同步会导致 CLI/package 与 TUI banner 版本不一致。
- **设计 bundle confusable**：5ab8ad1 的旧布局截图与 84d513c v2 同目录；取用前看 `design-map.md`。
- **Owner brief 先于 push**：spec-025 曾出现实现本地完成、`origin/dev` 仍旧；VERIFY 必须 fetch 实测。
- **expanded tool output**：早期实现静默截 8 行，QA 才抓到；工具输出改动必须验折叠/展开与完整性。
- npm 登录 token 会过期，publish 可能以 E404 伪装权限问题；发布前由 owner 先 `npm whoami`。

## 待 ByAnDa 决策清单
- 是否批准 spec-026：最小 CI + durable TUI 文本帧测试 + bump 脚本；若建 CI，还需她在 GitHub 设 required check。
- 是否明确背书 Lead 的“只改版本字面量”发布链 bump 窄例外。
- v2 Phase B 优先级：reasoning 流 / approval+autonomy / @files / fork / search/date / subagent。
- 是否单独收口 <=62 列 resume 筛选。
- 是否提供/授权真实 provider 凭证做独立 wire 冒烟；未授权前不得擅用现有 `~/.kaleid` secrets。
