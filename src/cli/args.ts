export const DEFAULT_MODEL = "gpt-5.5";

export type Command = "login" | "logout" | "repl" | "oneshot";

export interface ParsedArgs {
  command: Command;
  prompt?: string;
  model: string;
  help: boolean;
  version: boolean;
}

export const USAGE = `Usage:
  kaleid login
  kaleid logout
  kaleid
  kaleid "<prompt>"
  kaleid -p "<prompt>"

Options:
  --model <id>     Model to use (default: gpt-5.5)
  -p, --print      Run one-shot mode with the provided prompt
  -h, --help       Show this help
  -v, --version    Show the version`;

export function parseArgs(argv: string[]): ParsedArgs {
  let model = DEFAULT_MODEL;
  let help = false;
  let version = false;
  let printPrompt: string | undefined;
  const positionals: string[] = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === undefined) {
      continue;
    }

    if (arg === "--") {
      positionals.push(...argv.slice(i + 1));
      break;
    }

    if (arg === "-h" || arg === "--help") {
      help = true;
      continue;
    }

    if (arg === "-v" || arg === "--version") {
      version = true;
      continue;
    }

    if (arg === "--model") {
      const value = argv[i + 1];
      if (!value) {
        throw new Error("--model requires a value");
      }
      model = value;
      i += 1;
      continue;
    }

    if (arg.startsWith("--model=")) {
      const value = arg.slice("--model=".length);
      if (!value) {
        throw new Error("--model requires a value");
      }
      model = value;
      continue;
    }

    if (arg === "-p" || arg === "--print") {
      const value = argv[i + 1];
      if (!value) {
        throw new Error(`${arg} requires a prompt`);
      }
      printPrompt = value;
      i += 1;
      continue;
    }

    positionals.push(arg);
  }

  const explicitCommand = positionals[0];
  if (explicitCommand === "login" || explicitCommand === "logout") {
    return { command: explicitCommand, model, help, version };
  }

  if (printPrompt !== undefined) {
    return { command: "oneshot", prompt: printPrompt, model, help, version };
  }

  if (positionals.length > 0) {
    return {
      command: "oneshot",
      prompt: positionals.join(" "),
      model,
      help,
      version
    };
  }

  return { command: "repl", model, help, version };
}
