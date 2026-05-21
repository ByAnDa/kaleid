export interface AvailableModel {
  id: string;
  label?: string;
}

export const DEFAULT_MODEL = "gpt-5.5";

export const AVAILABLE_MODELS: AvailableModel[] = [
  { id: "gpt-5.5" },
  { id: "gpt-5.5-pro" },
  { id: "gpt-5.3-codex" },
  { id: "gpt-5.2-codex" },
  { id: "gpt-5.1-codex" },
  { id: "gpt-5-codex" }
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
