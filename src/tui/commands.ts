import { login as defaultLogin, type OAuthOptions } from "../auth/oauth.js";
import {
  load as defaultLoad,
  logout as defaultLogout,
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
  { command: "/login", description: "Sign in with OpenAI OAuth" },
  { command: "/logout", description: "Sign out and remove ~/.kaleid/auth.json" },
  { command: "/exit", description: "Exit kaleid" },
  { command: "/help", description: "Show available slash commands" }
];

export const SLASH_HELP = SLASH_COMMANDS.map(
  (command) => `${command.command.padEnd(8)} ${command.description}`
).join("\n");

export function parseSlash(input: string): ParsedSlashCommand | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith("/")) {
    return null;
  }

  const [command = "/", ...args] = trimmed.split(/\s+/u);
  return { command, args };
}

export function getSlashCommandCompletions(input: string): SlashCommandDefinition[] | null {
  if (!input.startsWith("/") || /\s/u.test(input)) {
    return null;
  }

  return SLASH_COMMANDS.filter((command) => command.command.startsWith(input));
}

export async function runSlashCommand(
  parsed: ParsedSlashCommand,
  context: SlashCommandContext = {}
): Promise<SlashCommandResult> {
  const login = context.login ?? defaultLogin;
  const load = context.load ?? defaultLoad;
  const logout = context.logout ?? defaultLogout;
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
      messages: ["已登出。后续请使用 /login 登录。"]
    };
  }

  if (parsed.command === "/login") {
    const messages: string[] = [];
    const existing = await load();
    if (existing) {
      messages.push(`已登录为 ${existing.accountId}，开始重新登录...`);
    }

    const creds = await login(context.loginOptions);
    await save(creds);
    messages.push(`登录成功: ${creds.accountId}`);
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
