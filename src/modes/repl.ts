import React from "react";
import { render } from "ink";
import { createSession } from "../loop/session.js";
import { loadLatestSession, loadSessionData, type ResumeRequest } from "../loop/session-store.js";
import { runTurn } from "../loop/agent-loop.js";
import { tools } from "../tools/index.js";
import { App } from "../tui/app.js";
import { createDiffingTerminalOutput, enterAlternateScreen } from "../tui/terminal.js";

export interface ReplOptions {
  model: string;
  cwd: string;
  resume?: ResumeRequest;
}

async function resolveInitialSession(options: ReplOptions): Promise<{ session: ReturnType<typeof createSession>; openResumeSelector: boolean }> {
  if (options.resume?.kind === "id") {
    const data = await loadSessionData(options.resume.id);
    return {
      session: createSession({ id: data.id, messages: data.messages, metadata: data.metadata, persisted: true, model: options.model }),
      openResumeSelector: false
    };
  }

  if (options.resume?.kind === "latest") {
    const data = await loadLatestSession();
    if (data) {
      return {
        session: createSession({ id: data.id, messages: data.messages, metadata: data.metadata, persisted: true, model: options.model }),
        openResumeSelector: false
      };
    }
  }

  return {
    session: createSession({ model: options.model }),
    openResumeSelector: options.resume?.kind === "select"
  };
}

export async function runRepl(options: ReplOptions): Promise<void> {
  const { session, openResumeSelector } = await resolveInitialSession(options);
  const restoreScreen = enterAlternateScreen(process.stdout);
  const stdout = createDiffingTerminalOutput(process.stdout);
  const instance = render(
    React.createElement(App, {
      model: options.model,
      cwd: options.cwd,
      session,
      tools,
      runTurn,
      openResumeSelectorOnStart: openResumeSelector
    }),
    { exitOnCtrlC: false, stdout }
  );

  void instance.waitUntilExit().finally(restoreScreen);
}
