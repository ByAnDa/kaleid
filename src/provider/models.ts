export interface AvailableModel {
  id: string;
  provider: ProviderId;
  label: string;
}

export type ProviderId = "openai-codex" | "deepseek" | "kimi";

export const DEFAULT_MODEL = "gpt-5.5";
export const DEFAULT_PROVIDER: ProviderId = "openai-codex";
export const DEFAULT_CONTEXT_WINDOW_TOKENS = 128000;
export const DEFAULT_RESERVE_TOKENS = 16384;
export const DEFAULT_KEEP_RECENT_TOKENS = 20000;
export const TOKEN_WARNING_PERCENT = 85;

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  "openai-codex": "[openai-codex]",
  deepseek: "[deepseek]",
  kimi: "[kimi]"
};

export function providerLabel(provider: ProviderId): string {
  return PROVIDER_LABELS[provider];
}

// Bundled model registry synced from pi's [openai-codex] table for spec-012.
// This is not a live list-models query; refresh it when pi's openai-codex table changes.
export const OPENAI_CODEX_MODELS: AvailableModel[] = [
  { id: "o4-mini-deep-research", provider: "openai-codex", label: providerLabel("openai-codex") },
  { id: "gpt-5.2", provider: "openai-codex", label: providerLabel("openai-codex") },
  { id: "gpt-5.3-codex", provider: "openai-codex", label: providerLabel("openai-codex") },
  { id: "gpt-5.3-codex-spark", provider: "openai-codex", label: providerLabel("openai-codex") },
  { id: "gpt-5.4", provider: "openai-codex", label: providerLabel("openai-codex") },
  { id: "gpt-5.4-mini", provider: "openai-codex", label: providerLabel("openai-codex") },
  { id: "gpt-5.5", provider: "openai-codex", label: providerLabel("openai-codex") }
];

export const DEEPSEEK_FALLBACK_MODELS: AvailableModel[] = [
  { id: "deepseek-v4-pro", provider: "deepseek", label: providerLabel("deepseek") },
  { id: "deepseek-v4-flash", provider: "deepseek", label: providerLabel("deepseek") }
];

export const KIMI_MODELS: AvailableModel[] = [
  { id: "kimi-for-coding", provider: "kimi", label: providerLabel("kimi") }
];

export const AVAILABLE_MODELS: AvailableModel[] = [...OPENAI_CODEX_MODELS];

export interface ModelMemoryConfig {
  contextWindow: number;
  reserveTokens: number;
  keepRecentTokens: number;
  warningPercent: number;
}

export const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  "o4-mini-deep-research": 200000,
  "gpt-5.2": 272000,
  "gpt-5.3-codex": 272000,
  "gpt-5.3-codex-spark": 272000,
  "gpt-5.4": 272000,
  "gpt-5.4-mini": 272000,
  "gpt-5.5": 272000,
  "deepseek-v4-pro": 128000,
  "deepseek-v4-flash": 128000,
  "deepseek-reasoner": 128000,
  "kimi-for-coding": 128000
};

export function getModelContextWindow(modelId: string): number {
  return MODEL_CONTEXT_WINDOWS[modelId] ?? DEFAULT_CONTEXT_WINDOW_TOKENS;
}

export function getModelMemoryConfig(modelId: string): ModelMemoryConfig {
  return {
    contextWindow: getModelContextWindow(modelId),
    reserveTokens: DEFAULT_RESERVE_TOKENS,
    keepRecentTokens: DEFAULT_KEEP_RECENT_TOKENS,
    warningPercent: TOKEN_WARNING_PERCENT
  };
}

export const REASONING_LEVELS = ["minimal", "low", "medium", "high", "xhigh"] as const;
export type ReasoningEffort = (typeof REASONING_LEVELS)[number];
export const DEFAULT_REASONING_EFFORT: ReasoningEffort = "medium";

export function isReasoningEffort(value: string): value is ReasoningEffort {
  return (REASONING_LEVELS as readonly string[]).includes(value);
}

export function providerSupportsReasoningEffort(provider: ProviderId | undefined): boolean {
  return (provider ?? DEFAULT_PROVIDER) === "openai-codex";
}

export function getProviderForModel(
  modelId: string,
  models: AvailableModel[] = AVAILABLE_MODELS
): ProviderId {
  const registered = models.find((model) => model.id === modelId)?.provider;
  if (registered) {
    return registered;
  }

  if (modelId.startsWith("deepseek-")) {
    return "deepseek";
  }

  if (modelId.startsWith("kimi-")) {
    return "kimi";
  }

  return DEFAULT_PROVIDER;
}

export function getModelOptions(
  currentModel: string,
  models: AvailableModel[] = AVAILABLE_MODELS
): AvailableModel[] {
  if (models.some((model) => model.id === currentModel)) {
    return models;
  }

  return [{ id: currentModel, provider: DEFAULT_PROVIDER, label: "custom" }, ...models];
}
