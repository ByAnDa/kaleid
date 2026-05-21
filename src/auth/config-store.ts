import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { ProviderId } from "../provider/models.js";

export type ApiKeyProviderId = Extract<ProviderId, "deepseek" | "kimi">;

export interface KaleidConfig {
  deepseek?: { apiKey?: string };
  kimi?: { apiKey?: string };
}

const ENV_KEY_BY_PROVIDER: Record<ApiKeyProviderId, string> = {
  deepseek: "DEEPSEEK_API_KEY",
  kimi: "KIMI_API_KEY"
};

export function configFilePath(): string {
  return process.env.KALEID_CONFIG_FILE ?? join(homedir(), ".kaleid", "config.json");
}

function isConfig(value: unknown): value is KaleidConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return ["deepseek", "kimi"].every((provider) => {
    const entry = candidate[provider];
    return (
      entry === undefined ||
      (typeof entry === "object" &&
        entry !== null &&
        !Array.isArray(entry) &&
        (((entry as Record<string, unknown>).apiKey === undefined) ||
          typeof (entry as Record<string, unknown>).apiKey === "string"))
    );
  });
}

export async function loadConfig(): Promise<KaleidConfig> {
  try {
    const raw = await readFile(configFilePath(), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!isConfig(parsed)) {
      throw new Error("Invalid config file format");
    }
    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {};
    }
    throw error;
  }
}

export async function saveConfig(config: KaleidConfig): Promise<void> {
  const file = configFilePath();
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  await chmod(file, 0o600);
}

export function envApiKey(provider: ApiKeyProviderId): string | null {
  const value = process.env[ENV_KEY_BY_PROVIDER[provider]]?.trim();
  return value ? value : null;
}

export async function getApiKey(provider: ApiKeyProviderId): Promise<string | null> {
  const envValue = envApiKey(provider);
  if (envValue) {
    return envValue;
  }

  const config = await loadConfig();
  const stored = config[provider]?.apiKey?.trim();
  return stored ? stored : null;
}

export async function saveApiKey(provider: ApiKeyProviderId, apiKey: string): Promise<void> {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    throw new Error("API key is empty");
  }

  const config = await loadConfig();
  await saveConfig({
    ...config,
    [provider]: { ...config[provider], apiKey: trimmed }
  });
}

export async function clearApiKeys(provider?: ApiKeyProviderId): Promise<void> {
  if (!provider) {
    await rm(configFilePath(), { force: true });
    return;
  }

  const config = await loadConfig();
  const next = { ...config };
  delete next[provider];
  await saveConfig(next);
}
