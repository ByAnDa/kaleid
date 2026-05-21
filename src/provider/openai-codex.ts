import { ORIGINATOR } from "../auth/constants.js";
import { forceRefresh, ensureValid, type Creds } from "../auth/token-store.js";
import { buildRequestBody } from "./responses-encode.js";
import { parseResponsesSSE } from "./responses-sse.js";
import type { ChatParams, LLMProvider, StreamEvent } from "./types.js";

export const CODEX_RESPONSES_URL = "https://chatgpt.com/backend-api/codex/responses";

export interface OpenAICodexProviderOptions {
  fetchImpl?: typeof fetch;
  version?: string;
  responsesUrl?: string;
  tokenStore?: {
    ensureValid(): Promise<Creds>;
    forceRefresh(): Promise<Creds>;
  };
}

export class OpenAICodexProvider implements LLMProvider {
  readonly id = "openai-codex";
  private readonly fetchImpl: typeof fetch;
  private readonly version: string;
  private readonly responsesUrl: string;
  private readonly tokenStore: {
    ensureValid(): Promise<Creds>;
    forceRefresh(): Promise<Creds>;
  };

  constructor(options: OpenAICodexProviderOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.version = options.version ?? "0.1.0";
    this.responsesUrl = options.responsesUrl ?? CODEX_RESPONSES_URL;
    this.tokenStore =
      options.tokenStore ?? {
        ensureValid: () => ensureValid({ fetchImpl: this.fetchImpl }),
        forceRefresh: () => forceRefresh({ fetchImpl: this.fetchImpl })
      };
  }

  async *chat(params: ChatParams): AsyncIterable<StreamEvent> {
    let creds = await this.tokenStore.ensureValid();
    let response = await this.post(params, creds);

    if (response.status === 401) {
      creds = await this.tokenStore.forceRefresh();
      response = await this.post(params, creds);
      if (response.status === 401) {
        throw new Error("Authentication expired. Run: kaleid login");
      }
    }

    if (response.status === 429) {
      const text = await response.text().catch(() => "");
      throw new Error(`OpenAI usage limit or rate limit reached${text ? `: ${text}` : ""}`);
    }

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`OpenAI Codex request failed (${response.status}): ${text || response.statusText}`);
    }

    if (!response.body) {
      throw new Error("OpenAI Codex response did not include a stream body");
    }

    yield* parseResponsesSSE(response.body);
  }

  private async post(params: ChatParams, creds: Creds): Promise<Response> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${creds.access}`,
      "chatgpt-account-id": creds.accountId,
      originator: ORIGINATOR,
      "OpenAI-Beta": "responses=experimental",
      accept: "text/event-stream",
      "Content-Type": "application/json",
      "User-Agent": `kaleid/${this.version}`
    };

    if (params.sessionId) {
      headers.session_id = params.sessionId;
    }

    return this.fetchImpl(this.responsesUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(buildRequestBody(params)),
      signal: params.signal
    });
  }
}
