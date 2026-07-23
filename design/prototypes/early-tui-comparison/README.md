# kaleid TUI demos — ink vs readline+ANSI

> ⚠️ **历史原型，不是现行设计目标。**
>
> 这是 2026-05-21 在单机目录 `~/kaleid-tui-demos/` 做的 Ink / readline 选型 spike，
> 最后取用于 2026-05-21，2026-07-23 按 P1「机器消失仍可恢复」规则原样抢救进仓。
> 它只证明早期防闪与技术选型探索；现行视觉与交互依据见
> `docs/handover/design-map.md`。`node_modules/` 未入仓，可由 lockfile 重建。

两个最小可跑 demo，同一套流程：**输入 → 流式回显 assistant → 假 bash 工具调用(带 spinner) → 状态切换 → 回到输入**。
重点验证：**无闪烁**。在真实终端里跑，对比手感后选型。

## 跑法

```bash
# 方案 1: ink (React for CLI)
cd ink-demo && npm install && npm start

# 方案 2: readline + ANSI (零依赖)
cd readline-demo && npm start      # 无需 install
```

输入消息回车；输入 `exit` 退出。

## 防闪设计（两者都已落实）

**ink**（`ink-demo/src/app.tsx`）
- 已完成的历史消息全部进 `<Static>` —— ink 对 Static「渲一次、永不重绘」，历史再长也不随帧重画。这是消除闪烁的根因（Claude Code 早期闪烁正是把大块动态区整体重渲所致）。
- 只有「正在流式的那条 + spinner + 输入框」在动态区，ink reconciler 只 patch 变化行、不整屏清除。
- 消息一完成立刻 commit 进 Static，动态区始终很小。

**readline + ANSI**（`readline-demo/app.mjs`）
- 输出纯追加写 stdout，终端自然下滚，**全程不清屏**。
- spinner 只用 `\r` 覆盖自己那一行，结束 `\r\x1b[K` 清掉。
- 输入与输出严格分轮（流式期间 `rl.pause()`），杜绝输入行被并发输出冲乱。

## 选型参考

| | ink | readline + ANSI |
|---|---|---|
| 依赖 | react + ink + 组件（~50 包）| 0（纯 Node 内置）|
| 代码量（拿到体面 UI）| 少（声明式）| 中（手管光标/重绘）|
| 流式 + spinner + 状态 | 天然好写 | 需手写但可控 |
| 构建 | 需 JSX 转译（tsx/esbuild）| 无 |
| 扩展成富 TUI（选择器/面板）| 无痛 | 痛，等于重造 ink |
| 启动速度 / 包体 | 略重 | 极轻 |
| clean-room 纯粹度 | 中 | 高 |

二者都已做到无闪。ink 用更少代码拿到更体面、更易扩展的结果；readline+ANSI 零依赖、极轻、最纯粹，适合「终端 TUI 长期保持薄 REPL」的前提。
