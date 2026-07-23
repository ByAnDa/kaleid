# kaleid Spec 索引
最后更新：2026-07-23 by @kaleidLead

> 本目录保存实施契约；产品口径唯一正本在 `docs/prd/`。状态以 `origin/dev` + Multica 实测为准，本表是历史导航，不代替 board。

| spec | 文件 | 交付版本 | Multica | 状态 |
|---|---|---|---|---|
| 001~007 | `kaleid-v1-spec.md` | 0.0.1 | BYW-96 | ✅ done |
| 008 | `spec-008-slash-commands.md` | 0.0.2 | BYW-97 | ✅ done |
| 009 | `spec-009-login-tui-fix.md` | 0.0.3 | BYW-100 | ✅ done |
| 010 | `spec-010-fullscreen-tui.md` | 0.0.4 | BYW-101 | ✅ done |
| 011 | `spec-011-model-selector.md` | 0.0.5 | BYW-105 | ✅ done |
| 012 | `spec-012-model-list-fix.md` | 0.0.6 dev-only → 随 0.0.8 发 | BYW-107 | ✅ done |
| 013 | `spec-013-deepseek-kimi-providers.md` | 0.0.7 dev-only → 随 0.0.8 发 | BYW-109 | ✅ done |
| 014 | `spec-014-conversation-memory.md` | 0.0.8 | BYW-110 | ✅ done |
| 015 | `spec-015-bugfix-batch.md` | 0.0.9 | BYW-111 | ✅ done |
| 016 | `spec-016-rename-project-conversation.md` | 0.0.10 | BYW-112 | ✅ done |
| 017 | `spec-017-project-and-labels.md` | 0.0.11 | BYW-113 | ✅ done |
| 018 | `spec-018-resume-filter.md` | 0.0.11 | BYW-114 | ✅ done |
| 019 | `spec-019-command-interactive-input.md` | 0.0.11 | BYW-115 | ✅ done |
| 020 | `spec-020-design-restyle-themes.md` | 0.0.12 | BYW-116 | ✅ done |
| 021 | `spec-021-apply-real-design-colors.md` | 0.0.12 | BYW-117 | ✅ done |
| 022 | `spec-022-tui-layout-polish.md` | 0.0.13 | BYW-118 | ✅ done |
| 023 | `spec-023-tui-statusline-and-scroll.md` | 0.0.14 | BYW-119 | ✅ done |
| 024 | `spec-024-banner-input-resume-fixes.md` | 0.0.15 | BYW-120 | ✅ done |
| 025 | `spec-025-v2-phase-a.md` | 0.0.16 | BYW-139 | ✅ done |

## 新 spec 规则
- 从 026 起：`spec-<NNN>-<slug>.md`，标签 `kaleid-spec-<NNN>`（紫 `#8b5cf6`）。
- 先更新 `docs/prd/` → ByAnDa CHECK → 才能 SEND。
- 每道门写清谁闭合、怎么跑/判过、输出贴哪里；真实 wire 与 TUI 肉眼门不得伪装成 squad 可闭合门。
