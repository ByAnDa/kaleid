import { spawn } from "node:child_process";
import { DEFAULT_MAX_BYTES, truncateHead } from "./truncate.js";

export interface BashResult {
  output: string;
  exitCode: number | undefined;
  truncated: boolean;
  cancelled: boolean;
}

const MAX_OUTPUT_BYTES = DEFAULT_MAX_BYTES * 2;

function killProcessTree(pid: number | undefined): void {
  if (!pid) {
    return;
  }

  try {
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", String(pid), "/T", "/F"], { stdio: "ignore" });
    } else {
      process.kill(-pid, "SIGTERM");
      setTimeout(() => {
        try {
          process.kill(-pid, "SIGKILL");
        } catch {
          // Process already exited.
        }
      }, 200).unref();
    }
  } catch {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // Process already exited.
    }
  }
}

function appendOutput(current: string, chunk: Buffer | string): { output: string; truncated: boolean } {
  const next = current + chunk.toString();
  if (Buffer.byteLength(next, "utf8") <= MAX_OUTPUT_BYTES) {
    return { output: next, truncated: false };
  }

  const truncated = truncateHead(next, { maxLines: Number.MAX_SAFE_INTEGER, maxBytes: MAX_OUTPUT_BYTES });
  return {
    output: `${truncated.text}\n[output truncated to ${MAX_OUTPUT_BYTES} bytes]\n`,
    truncated: true
  };
}

export async function executeBash(
  command: string,
  opts: { cwd: string; signal?: AbortSignal; timeoutSec?: number }
): Promise<BashResult> {
  return new Promise((resolve) => {
    const child = spawn("bash", ["-lc", command], {
      cwd: opts.cwd,
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"]
    });

    let output = "";
    let truncated = false;
    let cancelled = false;
    let settled = false;
    let timeout: NodeJS.Timeout | undefined;

    const finish = (exitCode: number | null | undefined) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timeout) {
        clearTimeout(timeout);
      }
      opts.signal?.removeEventListener("abort", abortHandler);
      resolve({
        output,
        exitCode: exitCode ?? undefined,
        truncated,
        cancelled
      });
    };

    const collect = (chunk: Buffer) => {
      const result = appendOutput(output, chunk);
      output = result.output;
      truncated = truncated || result.truncated;
    };

    const abortHandler = () => {
      cancelled = true;
      killProcessTree(child.pid);
    };

    if (opts.timeoutSec && opts.timeoutSec > 0) {
      timeout = setTimeout(() => {
        cancelled = true;
        killProcessTree(child.pid);
      }, opts.timeoutSec * 1000);
      timeout.unref();
    }

    if (opts.signal) {
      if (opts.signal.aborted) {
        abortHandler();
      } else {
        opts.signal.addEventListener("abort", abortHandler, { once: true });
      }
    }

    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    child.on("error", (error) => {
      output += `Failed to start command: ${error.message}`;
      finish(undefined);
    });
    child.on("close", (code) => finish(code));
  });
}
