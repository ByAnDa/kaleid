import { getApiKey } from "../auth/config-store.js";
import { load as loadCodexAuth } from "../auth/token-store.js";
import { OpenAICompatProvider } from "./openai-compat.js";
import { OpenAICodexProvider, type OpenAICodexProviderOptions } from "./openai-codex.js";
import {
  DEEPSEEK_FALLBACK_MODELS,
  KIMI_MODELS,
  OPENAI_CODEX_MODELS,
  getProviderForModel,
  providerLabel,
  type AvailableModel,
  type ProviderId
} from "./models.js";
import type { LLMProvider } from "./types.js";

export const DEEPSEEK_BASE_URL = "https://api.deepseek.com";
export const KIMI_BASE_URL = "https://api.kimi.com/coding/v1";

export interface ProviderRuntimeOptions {
  fetchImpl?: typeof fetch;
  codexOptions?: OpenAICodexProviderOptions;
}

export interface ProviderAuthState {
  "openai-codex": boolean;
  deepseek: boolean;
  kimi: boolean;
}

export async function getProviderAuthState(): Promise<ProviderAuthState> {
  const [codexCreds, deepseekKey, kimiKey] = await Promise.all([
    loadCodexAuth().catch(() => null),
    getApiKey("deepseek").catch(() => null),
    getApiKey("kimi").catch(() => null)
  ]);

  return {
    "openai-codex": codexCreds !== null,
    deepseek: deepseekKey !== null,
    kimi: kimiKey !== null
  };
}

export async function fetchDeepSeekModels(
  apiKey: string,
  fetchImpl: typeof fetch = fetch
): Promise<AvailableModel[]> {
  const response = await fetchImpl(`${DEEPSEEK_BASE_URL}/models`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`deepseek models request failed (${response.status}): ${text || response.statusText}`);
  }

  const payload = (await response.json()) as { data?: Array<{ id?: unknown }> };
  const ids = (payload.data ?? [])
    .map((model) => model.id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);

  if (ids.length === 0) {
    throw new Error("deepseek models response did not include models");
  }

  return ids.map((id) => ({ id, provider: "deepseek", label: providerLabel("deepseek") }));
}

export async function getAuthenticatedModels(options: ProviderRuntimeOptions = {}): Promise<AvailableModel[]> {
  const models: AvailableModel[] = [];
  const [authState, deepseekKey, kimiKey] = await Promise.all([
    getProviderAuthState(),
    getApiKey("deepseek").catch(() => null),
    getApiKey("kimi").catch(() => null)
  ]);

  if (authState["openai-codex"]) {
    models.push(...OPENAI_CODEX_MODELS);
  }

  if (deepseekKey) {
    try {
      models.push(...(await fetchDeepSeekModels(deepseekKey, options.fetchImpl ?? fetch)));
    } catch {
      models.push(...DEEPSEEK_FALLBACK_MODELS);
    }
  }

  if (kimiKey) {
    models.push(...KIMI_MODELS);
  }

  return models;
}

export async function createProviderForModel(
  model: string,
  models: AvailableModel[],
  options: ProviderRuntimeOptions = {}
): Promise<LLMProvider> {
  const provider = getProviderForModel(model, models);

  if (provider === "openai-codex") {
    return new OpenAICodexProvider({
      ...options.codexOptions,
      fetchImpl: options.codexOptions?.fetchImpl ?? options.fetchImpl
    });
  }

  const apiKey = await getApiKey(provider);
  if (!apiKey) {
    throw new Error(`Not logged in for ${provider}. Run /login first.`);
  }

  return new OpenAICompatProvider({
    id: provider,
    baseURL: provider === "deepseek" ? DEEPSEEK_BASE_URL : KIMI_BASE_URL,
    apiKey,
    defaultModel: model,
    fetchImpl: options.fetchImpl
  });
}

export async function ensureModelProviderAuthenticated(model: string): Promise<void> {
  const provider: ProviderId = getProviderForModel(model, [
    ...OPENAI_CODEX_MODELS,
    ...DEEPSEEK_FALLBACK_MODELS,
    ...KIMI_MODELS
  ]);

  if (provider === "openai-codex") {
    const creds = await loadCodexAuth();
    if (!creds) {
      throw new Error("Not logged in. Run `kaleid` and use /login");
    }
    return;
  }

  const apiKey = await getApiKey(provider);
  if (!apiKey) {
    throw new Error(`Not logged in for ${provider}. Run \`kaleid\` and use /login`);
  }
}
