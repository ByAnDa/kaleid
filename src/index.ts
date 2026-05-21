import { createRequire } from "node:module";
import { parseArgs, USAGE } from "./cli/args.js";
import { login } from "./auth/oauth.js";
import { ensureValid, logout, NotLoggedInError, save } from "./auth/token-store.js";
import { runOneShot } from "./modes/one-shot.js";
import { runRepl } from "./modes/repl.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string };

async function main(argv: string[]): Promise<number> {
  let args;
  try {
    args = parseArgs(argv);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n\n${USAGE}\n`);
    return 1;
  }

  if (args.version) {
    process.stdout.write(`${pkg.version}\n`);
    return 0;
  }

  if (args.help) {
    process.stdout.write(`${USAGE}\n`);
    return 0;
  }

  if (args.command === "login") {
    const creds = await login();
    await save(creds);
    process.stdout.write(`登录成功: ${creds.accountId}\n`);
    return 0;
  }

  if (args.command === "logout") {
    await logout();
    process.stdout.write("Logged out\n");
    return 0;
  }

  try {
    await ensureValid();
  } catch (error) {
    if (error instanceof NotLoggedInError) {
      process.stderr.write("请先运行: kaleid login\n");
      return 1;
    }
    throw error;
  }

  if (args.command === "oneshot") {
    return runOneShot({
      prompt: args.prompt ?? "",
      model: args.model,
      cwd: process.cwd()
    });
  }

  runRepl({ model: args.model, cwd: process.cwd() });
  return 0;
}

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
);
