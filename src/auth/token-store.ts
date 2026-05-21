import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { refresh as refreshToken } from "./oauth.js";

export interface Creds {
  access: string;
  refresh: string;
  expires: number;
  accountId: string;
}

export class NotLoggedInError extends Error {
  constructor() {
    super("Not logged in. Run: kaleid login");
    this.name = "NotLoggedInError";
  }
}

export function authFilePath(): string {
  return process.env.KALEID_AUTH_FILE ?? join(homedir(), ".kaleid", "auth.json");
}

function isCreds(value: unknown): value is Creds {
  const candidate = value as Partial<Creds>;
  return (
    typeof candidate?.access === "string" &&
    typeof candidate.refresh === "string" &&
    typeof candidate.expires === "number" &&
    typeof candidate.accountId === "string"
  );
}

export async function load(): Promise<Creds | null> {
  try {
    const raw = await readFile(authFilePath(), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!isCreds(parsed)) {
      throw new Error("Invalid auth file format");
    }
    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export async function save(creds: Creds): Promise<void> {
  const file = authFilePath();
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(creds, null, 2)}\n`, { mode: 0o600 });
  await import("node:fs/promises").then(({ chmod }) => chmod(file, 0o600));
}

export function isExpired(creds: Creds): boolean {
  return Date.now() >= creds.expires - 60_000;
}

export interface EnsureValidOptions {
  fetchImpl?: typeof fetch;
}

export async function forceRefresh(options: EnsureValidOptions = {}): Promise<Creds> {
  const creds = await load();
  if (!creds) {
    throw new NotLoggedInError();
  }
  const refreshed = await refreshToken(creds.refresh, options);
  await save(refreshed);
  return refreshed;
}

export async function ensureValid(options: EnsureValidOptions = {}): Promise<Creds> {
  const creds = await load();
  if (!creds) {
    throw new NotLoggedInError();
  }

  if (!isExpired(creds)) {
    return creds;
  }

  const refreshed = await refreshToken(creds.refresh, options);
  await save(refreshed);
  return refreshed;
}

export async function logout(): Promise<void> {
  await rm(authFilePath(), { force: true });
}
