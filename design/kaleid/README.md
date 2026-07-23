# CODING AGENTS: READ THIS FIRST

> **kaleid 项目接手提醒（2026-07-23）**：本文件只说明如何阅读 Claude Design 导出包；哪些文件属于现行设计、固定版本锚与禁引用项，以 repo `docs/handover/design-map.md` 为准。产品范围以 `docs/prd/core.md` 为准。
>
> **仓库保全状态**：外部 Claude Design 项目现已无授权、不可再取；repo
> 最后抓取副本即正本，禁止再尝试 fetch。导出包旧路径
> `design/kaleid/project/screenshots/` 的 9 张图已迁到
> `design/reference/`；逐项旧→新映射见 design-map。完整 raw 设计会话已补到
> `design/kaleid/chats/design-chat-kaleid-a60aadc1.json`。

This is a **handoff bundle** from Claude Design (claude.ai/design).

A user mocked up designs in HTML/CSS/JS using an AI design tool, then exported this bundle so a coding agent can implement the designs for real.

## What you should do — IMPORTANT

**Read the chat transcripts first.** There are 1 chat transcript(s) in `kaleid/chats/`. The transcripts show the full back-and-forth between the user and the design assistant — they tell you **what the user actually wants** and **where they landed** after iterating. Don't skip them. The final HTML files are the output, but the chat is where the intent lives.

**Find the primary design file under `kaleid/project/` and read it top to bottom.** The chat transcripts will tell you which file the user was last iterating on. Then **follow its imports**: open every file it pulls in (shared components, CSS, scripts) so you understand how the pieces fit together before you start implementing.

**If anything is ambiguous, ask the user to confirm before you start implementing.** It's much cheaper to clarify scope up front than to build the wrong thing.

## About the design files

The design medium is **HTML/CSS/JS** — these are prototypes, not production code. Your job is to **recreate them pixel-perfectly** in whatever technology makes sense for the target codebase (React, Vue, native, whatever fits). Match the visual output; don't copy the prototype's internal structure unless it happens to fit.

**Don't render these files in a browser or take screenshots unless the user asks you to.** Everything you need — dimensions, colors, layout rules — is spelled out in the source. Read the HTML and CSS directly; a screenshot won't tell you anything they don't.

## Bundle contents

- `kaleid/README.md` — this file
- `kaleid/chats/` — conversation transcripts (read these!)
- `kaleid/project/` — the `kaleid` project files (HTML prototypes, assets, components)
