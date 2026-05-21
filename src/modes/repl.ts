import React from "react";
import { render } from "ink";
import { createSession } from "../loop/session.js";
import { runTurn } from "../loop/agent-loop.js";
import { OpenAICodexProvider } from "../provider/openai-codex.js";
import { tools } from "../tools/index.js";
import { App } from "../tui/app.js";

export interface ReplOptions {
  model: string;
  cwd: string;
}

export function runRepl(options: ReplOptions): void {
  const session = createSession();
  const provider = new OpenAICodexProvider();
  render(
    React.createElement(App, {
      model: options.model,
      cwd: options.cwd,
      session,
      provider,
      tools,
      runTurn
    })
  );
}
