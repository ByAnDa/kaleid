import { createSession } from "../loop/session.js";
import { runTurn } from "../loop/agent-loop.js";
import { OpenAICodexProvider } from "../provider/openai-codex.js";
import { tools } from "../tools/index.js";

export interface OneShotOptions {
  prompt: string;
  model: string;
  cwd: string;
  stdout?: Pick<NodeJS.WriteStream, "write">;
  stderr?: Pick<NodeJS.WriteStream, "write">;
  signal?: AbortSignal;
}

function firstLine(text: string): string {
  return text.split(/\r?\n/u)[0] ?? "";
}

export async function runOneShot(options: OneShotOptions): Promise<number> {
  const stdout = options.stdout ?? process.stdout;
  const stderr = options.stderr ?? process.stderr;
  const session = createSession();
  const provider = new OpenAICodexProvider();

  for await (const event of runTurn(session, options.prompt, {
    provider,
    tools,
    model: options.model,
    cwd: options.cwd,
    signal: options.signal
  })) {
    if (event.type === "assistant_text") {
      stdout.write(event.delta);
    } else if (event.type === "tool_start") {
      stderr.write(`\n. ${event.activity}\n`);
    } else if (event.type === "tool_end") {
      stderr.write(`  ${event.result.isError ? "error" : "done"}: ${firstLine(event.result.output)}\n`);
    } else if (event.type === "error") {
      stderr.write(`\nError: ${event.message}\n`);
      return 1;
    } else if (event.type === "turn_done") {
      stdout.write("\n");
      return 0;
    }
  }

  return 0;
}
