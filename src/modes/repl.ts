import React from "react";
import { render } from "ink";
import { createSession } from "../loop/session.js";
import { runTurn } from "../loop/agent-loop.js";
import { OpenAICodexProvider } from "../provider/openai-codex.js";
import { tools } from "../tools/index.js";
import { App } from "../tui/app.js";
import { createDiffingTerminalOutput, enterAlternateScreen } from "../tui/terminal.js";

export interface ReplOptions {
  model: string;
  cwd: string;
}

export function runRepl(options: ReplOptions): void {
  const session = createSession();
  const provider = new OpenAICodexProvider();
  const restoreScreen = enterAlternateScreen(process.stdout);
  const stdout = createDiffingTerminalOutput(process.stdout);
  const instance = render(
    React.createElement(App, {
      model: options.model,
      cwd: options.cwd,
      session,
      provider,
      tools,
      runTurn
    }),
    { exitOnCtrlC: false, stdout }
  );

  void instance.waitUntilExit().finally(restoreScreen);
}
