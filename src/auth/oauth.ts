import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline/promises";
import {
  AUTHORIZE_URL,
  CLIENT_ID,
  JWT_CLAIM_PATH,
  ORIGINATOR,
  REDIRECT_URI,
  SCOPE,
  TOKEN_URL
} from "./constants.js";
import { startCallbackServer } from "./callback-server.js";
import { generatePKCE } from "./pkce.js";
import type { Creds } from "./token-store.js";

export interface OAuthOptions {
  fetchImpl?: typeof fetch;
  openBrowser?: (url: string) => Promise<boolean> | boolean;
  stdout?: Pick<NodeJS.WriteStream, "write">;
  stdin?: NodeJS.ReadStream;
  tokenUrl?: string;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

function generateState(): string {
  return randomBytes(16).toString("hex");
}

export function buildAuthorizeUrl(challenge: string, state: string): string {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", CLIENT_ID);
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("scope", SCOPE);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", state);
  url.searchParams.set("id_token_add_organizations", "true");
  url.searchParams.set("codex_cli_simplified_flow", "true");
  url.searchParams.set("originator", ORIGINATOR);
  return url.toString();
}

export function decodeAccountId(accessToken: string): string {
  const [, payload] = accessToken.split(".");
  if (!payload) {
    throw new Error("Access token is not a JWT");
  }

  const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown>;
  const claim = decoded[JWT_CLAIM_PATH] as { chatgpt_account_id?: unknown } | undefined;
  const accountId = claim?.chatgpt_account_id;

  if (typeof accountId !== "string" || accountId.length === 0) {
    throw new Error("Access token is missing chatgpt_account_id");
  }

  return accountId;
}

export function parseAuthorizationResponse(input: string, expectedState: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Missing OAuth code");
  }

  if (trimmed.includes("://")) {
    const url = new URL(trimmed);
    const actualState = url.searchParams.get("state");
    if (actualState !== expectedState) {
      throw new Error("OAuth state mismatch");
    }
    const code = url.searchParams.get("code");
    if (!code) {
      throw new Error("OAuth callback URL is missing code");
    }
    return code;
  }

  return trimmed;
}

export async function systemOpenBrowser(url: string): Promise<boolean> {
  const command =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "cmd"
        : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];

  try {
    const child = spawn(command, args, {
      detached: true,
      stdio: "ignore"
    });

    return await new Promise<boolean>((resolve) => {
      let settled = false;
      const settle = (opened: boolean) => {
        if (!settled) {
          settled = true;
          resolve(opened);
        }
      };

      child.once("error", () => settle(false));
      child.once("spawn", () => {
        child.unref();
        settle(true);
      });
    });
  } catch {
    return false;
  }
}

async function exchangeToken(
  body: URLSearchParams,
  options: Pick<OAuthOptions, "fetchImpl" | "tokenUrl">
): Promise<TokenResponse> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(options.tokenUrl ?? TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`OAuth token request failed (${response.status}): ${text || response.statusText}`);
  }

  const payload = (await response.json()) as Partial<TokenResponse>;
  if (!payload.access_token || typeof payload.expires_in !== "number") {
    throw new Error("OAuth token response is missing required fields");
  }

  return payload as TokenResponse;
}

function tokenResponseToCreds(payload: TokenResponse, refreshFallback?: string): Creds {
  const refreshToken = payload.refresh_token ?? refreshFallback;
  if (!refreshToken) {
    throw new Error("OAuth token response is missing refresh_token");
  }

  return {
    access: payload.access_token,
    refresh: refreshToken,
    expires: Date.now() + payload.expires_in * 1000,
    accountId: decodeAccountId(payload.access_token)
  };
}

async function waitForManualCode(
  state: string,
  options: Pick<OAuthOptions, "stdin" | "stdout"> & { signal?: AbortSignal }
): Promise<string | null> {
  const stdin = options.stdin ?? process.stdin;
  const stdout = options.stdout ?? process.stdout;

  if (!stdin.isTTY) {
    return null;
  }

  const rl = createInterface({ input: stdin, output: stdout as NodeJS.WritableStream });
  try {
    const input = await rl.question("Paste OAuth code or callback URL: ", { signal: options.signal });
    return parseAuthorizationResponse(input, state);
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      return null;
    }
    throw error;
  } finally {
    rl.close();
  }
}

export async function login(options: OAuthOptions = {}): Promise<Creds> {
  const { verifier, challenge } = await generatePKCE();
  const state = generateState();
  const authorizeUrl = buildAuthorizeUrl(challenge, state);
  const server = await startCallbackServer(state);
  const stdout = options.stdout ?? process.stdout;

  try {
    const opened = await (options.openBrowser ?? systemOpenBrowser)(authorizeUrl);
    if (!opened || !server.available) {
      stdout.write(`Open this URL to authenticate:\n${authorizeUrl}\n`);
    }

    const manualAbort = new AbortController();
    const manualPromise = waitForManualCode(state, { ...options, signal: manualAbort.signal }).catch((error: unknown) => {
      throw error instanceof Error ? error : new Error(String(error));
    });
    const serverPromise = server.waitForCode().then((result) => result?.code ?? null);
    const code = server.available ? await Promise.race([serverPromise, manualPromise]) : await manualPromise;
    manualAbort.abort();

    if (!code) {
      throw new Error(
        server.available
          ? "OAuth login was cancelled or failed"
          : `Callback port unavailable. Open this URL and paste the returned code:\n${authorizeUrl}`
      );
    }

    const body = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: CLIENT_ID,
      code,
      code_verifier: verifier,
      redirect_uri: REDIRECT_URI
    });
    const payload = await exchangeToken(body, options);
    return tokenResponseToCreds(payload);
  } finally {
    await server.close();
  }
}

export async function refresh(refreshToken: string, options: OAuthOptions = {}): Promise<Creds> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: CLIENT_ID
  });
  const payload = await exchangeToken(body, options);
  return tokenResponseToCreds(payload, refreshToken);
}
