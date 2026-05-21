import http from "node:http";
import { CALLBACK_HOST, CALLBACK_PORT } from "./constants.js";

export interface CallbackResult {
  code: string;
}

export interface CallbackServer {
  readonly available: boolean;
  readonly url: string;
  waitForCode(): Promise<CallbackResult | null>;
  cancelWait(): void;
  close(): Promise<void>;
}

function html(message: string): string {
  return `<!doctype html><html><body><h1>${message}</h1></body></html>`;
}

function unavailableServer(): CallbackServer {
  return {
    available: false,
    url: `http://localhost:${CALLBACK_PORT}/auth/callback`,
    waitForCode: async () => null,
    cancelWait: () => undefined,
    close: async () => undefined
  };
}

export async function startCallbackServer(state: string): Promise<CallbackServer> {
  let resolveWait: ((value: CallbackResult | null) => void) | null = null;
  let settled = false;

  const waitPromise = new Promise<CallbackResult | null>((resolve) => {
    resolveWait = resolve;
  });

  const settle = (value: CallbackResult | null) => {
    if (!settled) {
      settled = true;
      resolveWait?.(value);
    }
  };

  const server = http.createServer((req, res) => {
    const requestUrl = new URL(req.url ?? "/", `http://${CALLBACK_HOST}:${CALLBACK_PORT}`);

    if (req.method !== "GET" || requestUrl.pathname !== "/auth/callback") {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    const actualState = requestUrl.searchParams.get("state");
    const code = requestUrl.searchParams.get("code");

    if (actualState !== state) {
      res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Invalid OAuth state");
      settle(null);
      return;
    }

    if (!code) {
      res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Missing OAuth code");
      settle(null);
      return;
    }

    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html("OpenAI 认证完成，可关闭此窗口"));
    settle({ code });
  });

  const listened = await new Promise<boolean>((resolve) => {
    server.once("error", () => resolve(false));
    server.listen(CALLBACK_PORT, CALLBACK_HOST, () => resolve(true));
  });

  if (!listened) {
    server.close();
    return unavailableServer();
  }

  return {
    available: true,
    url: `http://localhost:${CALLBACK_PORT}/auth/callback`,
    waitForCode: () => waitPromise,
    cancelWait: () => settle(null),
    close: async () => {
      settle(null);
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
  };
}
