export interface AvailableModel {
  id: string;
  provider: ProviderId;
  label: string;
}

export type ProviderId = "openai-codex" | "deepseek" | "kimi";

export const DEFAULT_MODEL = "gpt-5.5";
export const DEFAULT_PROVIDER: ProviderId = "openai-codex";

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
