import { relative, resolve } from "node:path";

export function resolveToolPath(cwd: string, inputPath: string): string {
  return resolve(cwd, inputPath);
}

export function displayPath(cwd: string, fullPath: string): string {
  const rel = relative(cwd, fullPath);
  return rel.length === 0 ? "." : rel;
}
