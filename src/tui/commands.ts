import { login as defaultLogin, type OAuthOptions } from "../auth/oauth.js";
import { clearApiKeys as defaultClearApiKeys } from "../auth/config-store.js";
import {
  load as defaultLoad,
  logout as defaultCodexLogout,
  save as defaultSave,
  type Creds
} from "../auth/token-store.js";

export interface ParsedSlashCommand {
  command: string;
  args: string[];
}

export interface SlashCommandResult {
  action: "continue" | "exit";
  messages: string[];
}

export interface SlashCommandDefinition {
  command: string;
  description: string;
}

export interface RenameCommandArgs {
  name: string;
  project?: string | null;
}

export interface ProjectCommandArgs {
  project: string;
}

export type ChatLabelCommandArgs =
  | { action: "add"; label: string }
  | { action: "remove"; label: string };

type LoginFn = (options?: OAuthOptions) => Promise<Creds>;
type LoadFn = () => Promise<Creds | null>;
type SaveFn = (creds: Creds) => Promise<void>;
type LogoutFn = () => Promise<void>;

export interface SlashCommandContext {
  login?: LoginFn;
  loginOptions?: OAuthOptions;
  load?: LoadFn;
  logout?: LogoutFn;
  save?: SaveFn;
}

export const SLASH_COMMANDS: SlashCommandDefinition[] = [
  { command: "/login", description: "Sign in to a provider" },
  { command: "/logout", description: "Sign out and remove kaleid credentials" },
  { command: "/model", description: "Select the current model" },
  { command: "/reasoning", description: "Select reasoning effort" },
  { command: "/compact", description: "Compact conversation context" },
  { command: "/resume", description: "Resume a saved session" },
  { command: "/rename", description: "Rename the current conversation" },
  { command: "/project", description: "Set the current conversation project" },
  { command: "/chatlabel", description: "Add or remove conversation labels" },
  { command: "/exit", description: "Exit kaleid" },
  { command: "/help", description: "Show available slash commands" }
];

export const SLASH_HELP = SLASH_COMMANDS.map(
  (command) => `${command.command.padEnd(8)} ${command.description}`
).join("\n");

export function parseSlash(input: string): ParsedSlashCommand | null {
  if (!input.startsWith("/")) {
    return null;
  }

  const trimmed = input.trimEnd();
  const [command = "/", ...args] = trimmed.split(/\s+/u);
  return { command, args };
}

export function getSlashCommandCompletions(input: string): SlashCommandDefinition[] | null {
  if (!input.startsWith("/") || /\s/u.test(input)) {
    return null;
  }

  return SLASH_COMMANDS.filter((command) => command.command.startsWith(input));
}

export function parseRenameCommandArgs(args: string[]): RenameCommandArgs | null {
  const value = args.join(" ").trim();
  if (!value) {
    return null;
  }

  const slashIndex = value.indexOf("/");
  if (slashIndex < 0) {
    return { name: value };
  }

  const project = value.slice(0, slashIndex).trim();
  const name = value.slice(slashIndex + 1).trim();
  if (!name) {
    return null;
  }

  return {
    project: project.length > 0 ? project : null,
    name
  };
}

export function parseProjectCommandArgs(args: string[]): ProjectCommandArgs | null {
  const project = args.join(" ").trim();
  return project ? { project } : null;
}

export function parseChatLabelCommandArgs(args: string[]): ChatLabelCommandArgs | null {
  const [first, ...rest] = args;
  if (first === "remove") {
    const label = rest.join(" ").trim();
    return label ? { action: "remove", label } : null;
  }

  const label = args.join(" ").trim();
  return label ? { action: "add", label } : null;
}

export async function runSlashCommand(
  parsed: ParsedSlashCommand,
  context: SlashCommandContext = {}
): Promise<SlashCommandResult> {
  const login = context.login ?? defaultLogin;
  const load = context.load ?? defaultLoad;
  const logout =
    context.logout ??
    (async () => {
      await defaultCodexLogout();
      await defaultClearApiKeys();
    });
  const save = context.save ?? defaultSave;

  if (parsed.command === "/help") {
    return {
      action: "continue",
      messages: [SLASH_HELP]
    };
  }

  if (parsed.command === "/exit") {
    return {
      action: "exit",
      messages: ["Bye"]
    };
  }

  if (parsed.command === "/logout") {
    await logout();
    return {
      action: "continue",
      messages: ["已登出所有 provider。后续请使用 /login 登录。"]
    };
  }

  if (
    parsed.command === "/model" ||
    parsed.command === "/reasoning" ||
    parsed.command === "/compact" ||
    parsed.command === "/resume" ||
    parsed.command === "/rename" ||
    parsed.command === "/project" ||
    parsed.command === "/chatlabel"
  ) {
    return {
      action: "continue",
      messages: [`${parsed.command} is available in the interactive TUI.`]
    };
  }

  if (parsed.command === "/login") {
    const messages: string[] = [];
    const existing = await load();
    if (existing) {
      messages.push(`已登录 OpenAI Codex 为 ${existing.accountId}，开始重新登录...`);
    }

    const creds = await login(context.loginOptions);
    await save(creds);
    messages.push(`已登录: openai-codex (${creds.accountId})`);
    return {
      action: "continue",
      messages
    };
  }

  return {
    action: "continue",
    messages: [`unknown command: ${parsed.command}\nRun /help to see available slash commands.`]
  };
}
