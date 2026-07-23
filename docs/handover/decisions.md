# 关键决策记录（git log 里没有的“为什么”）
最后更新：2026-07-23 by @kaleidLead

| 日期 | 决策 | 为什么（含放弃了什么） | 出处 |
|---|---|---|---|
| 2026-05-21 | clean-room 自研，不依赖/fork pi | 保留极简内核与自主架构；只借鉴公开模式，避免把成熟项目整体拖入 | ByAnDa msg 383a0a43；PRD |
| 2026-05-21 | TypeScript + Node + Ink TUI | 与目标 CLI/JS 生态和 npm 分发匹配；放弃 readline demo | ByAnDa msg 27432843 |
| 2026-05-22 | 默认 provider 改为 Codex OAuth，默认模型 gpt-5.5 | 用 ByAnDa 的 ChatGPT 订阅工作流；接受其政策/稳定性风险 | ByAnDa msg 99cf6142 / da363b14 |
| 2026-05-22 | 包保持 UNLICENSED，不放 LICENSE | ByAnDa 明确保留全部权利，虽公开源码/可安装但不授权再分发或修改 | ByAnDa msg baffa046 |
| 2026-05-22 | 公共材料去掉 Claude Code 泄露源链接 | 避免公开项目的 IP/声誉风险；只保留不带来源链接的架构灵感描述 | ByAnDa 公网发布决策；commit 8727990 |
| 2026-05-22 | squad 必须 feature 分支、自 merge dev、禁发布与 bump；版本只走 0.0.x | 修正 spec-016 越权 publish/升 0.1.0，明确代码实施与发布权分离 | ByAnDa msg ed564fbe |
| 2026-05-22 | Daylight/Spectrum 默认跟随终端；px/字号/圆角忽略；交互全键盘 | CLI 无法控制终端窗口背景/字号/像素，且鼠标路径不稳定 | ByAnDa msg c017bec8 |
| 2026-05-26 | v2 设计拆 Phase A / B，先做 A，B 禁空壳 | 大量设计元素依赖尚不存在的 backend 能力；先交付真实数据可驱动的 UI | ByAnDa msg 4d57a4e5 |
| 2026-07-10 | Lead 不改状态、不代合；已派 issue no-stop，问题 fix-forward | 权限与责任收口；派单不可逆，所以 gate 必须在 SEND 前 | Architect 最终 SOP；ByAnDa 锁定 |
| 2026-07-10 | kaleid 无 staging，STAGE(a) 映射为 npm publish 提请 | publish 才会改变他人可见运行态；合 dev 不等于部署 | Architect 最终 SOP + kaleid 项目适配 |
| 2026-07-23 | `docs/prd/` 为 PRD 唯一正本，`docs/handover/` 为接手层 | 避免 Lead 会话/vault/聊天成为人肉单点；新 AI 可冷读接手 | Architect task #2（ByAnDa 拍板） |
