import { parseArgs, USAGE } from "./args.js";
import { ensureValid as defaultEnsureValid, NotLoggedInError } from "../auth/token-store.js";
import { runOneShot as defaultRunOneShot } from "../modes/one-shot.js";
import { runRepl as defaultRunRepl } from "../modes/repl.js";
import { ensureModelProviderAuthenticated as defaultEnsureModelProviderAuthenticated } from "../provider/registry.js";

export const ONE_SHOT_LOGIN_HINT = "请先运行 `kaleid` 并执行 `/login` 登录\n";

export interface CliRuntime {
  cwd?: string;
  stdout?: Pick<NodeJS.WriteStream, "write">;
  stderr?: Pick<NodeJS.WriteStream, "write">;
}

export interface CliDeps {
  ensureValid?: typeof defaultEnsureValid;
  ensureCanUseModel?: (model: string) => Promise<void>;
  packageVersion: string;
  runOneShot?: typeof defaultRunOneShot;
  runRepl?: typeof defaultRunRepl;
}

export async function runCli(argv: string[], deps: CliDeps, runtime: CliRuntime = {}): Promise<number> {
  const stdout = runtime.stdout ?? process.stdout;
  const stderr = runtime.stderr ?? process.stderr;
  const cwd = runtime.cwd ?? process.cwd();
  const ensureValid = deps.ensureValid ?? defaultEnsureValid;
  const ensureCanUseModel =
    deps.ensureCanUseModel ??
    (deps.ensureValid
      ? async () => {
          await ensureValid();
        }
      : defaultEnsureModelProviderAuthenticated);
  const runOneShot = deps.runOneShot ?? defaultRunOneShot;
  const runRepl = deps.runRepl ?? defaultRunRepl;

  let args;
  try {
    args = parseArgs(argv);
  } catch (error) {
    stderr.write(`${error instanceof Error ? error.message : String(error)}\n\n${USAGE}\n`);
    return 1;
  }

  if (args.version) {
    stdout.write(`${deps.packageVersion}\n`);
    return 0;
  }

  if (args.help) {
    stdout.write(`${USAGE}\n`);
    return 0;
  }

  if (args.command === "oneshot") {
    try {
      await ensureCanUseModel(args.model);
    } catch (error) {
      if (error instanceof NotLoggedInError || (error instanceof Error && /Not logged in/u.test(error.message))) {
        stderr.write(ONE_SHOT_LOGIN_HINT);
        return 1;
      }
      throw error;
    }

    return runOneShot({
      prompt: args.prompt ?? "",
      model: args.model,
      cwd,
      stdout,
      stderr
    });
  }

  runRepl({ model: args.model, cwd });
  return 0;
}
