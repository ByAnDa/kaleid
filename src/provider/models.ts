export interface AvailableModel {
  id: string;
  label?: string;
}

export const DEFAULT_MODEL = "gpt-5.5";

// Bundled model registry synced from pi's [openai-codex] table for spec-012.
// This is not a live list-models query; refresh it when pi's openai-codex table changes.
export const AVAILABLE_MODELS: AvailableModel[] = [
  { id: "o4-mini-deep-research", label: "[openai-codex]" },
  { id: "gpt-5.2", label: "[openai-codex]" },
  { id: "gpt-5.3-codex", label: "[openai-codex]" },
  { id: "gpt-5.3-codex-spark", label: "[openai-codex]" },
  { id: "gpt-5.4", label: "[openai-codex]" },
  { id: "gpt-5.4-mini", label: "[openai-codex]" },
  { id: "gpt-5.5", label: "[openai-codex]" }
];

export const REASONING_LEVELS = ["minimal", "low", "medium", "high", "xhigh"] as const;
export type ReasoningEffort = (typeof REASONING_LEVELS)[number];
export const DEFAULT_REASONING_EFFORT: ReasoningEffort = "medium";

export function isReasoningEffort(value: string): value is ReasoningEffort {
  return (REASONING_LEVELS as readonly string[]).includes(value);
}

export function getModelOptions(currentModel: string): AvailableModel[] {
  if (AVAILABLE_MODELS.some((model) => model.id === currentModel)) {
    return AVAILABLE_MODELS;
  }

  return [{ id: currentModel, label: "custom" }, ...AVAILABLE_MODELS];
}
