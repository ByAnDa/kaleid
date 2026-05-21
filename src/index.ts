import { createRequire } from "node:module";
import { runCli } from "./cli/run.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string };

runCli(process.argv.slice(2), { packageVersion: pkg.version }).then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
);
