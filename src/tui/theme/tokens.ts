export type ThemeName = "daylight" | "spectrum";
export type ThemeMode = "system" | ThemeName;
export type TerminalAppearance = "dark" | "light";
export type TerminalColorLevel = "truecolor" | "ansi256" | "ansi16";

export type RoleTokenName = "system" | "user" | "assistant" | "tool" | "error";
export type StatusTokenName = "ok" | "warn" | "err" | "info";
export type TagTokenName =
  | "review"
  | "wip"
  | "design"
  | "infra"
  | "planning"
  | "refactor"
  | "docs"
  | "inbox";

export interface RoleColorTokens {
  fg: string;
  gutter: string;
}

export interface BadgeColorTokens {
  bg: string;
  fg: string;
}

export interface ThemeColorTokens {
  surface: {
    canvas: string;
    panel: string;
    raised: string;
    chrome: string;
  };
  text: {
    primary: string;
    secondary: string;
    muted: string;
    subtle: string;
    faint: string;
    onChrome: string;
  };
  border: {
    strong: string;
    default: string;
    subtle: string;
  };
  accent: {
    primary: string;
    secondary: string;
    quiet: string;
  };
  role: Record<RoleTokenName, RoleColorTokens>;
  status: Record<StatusTokenName, string>;
  tag: Record<TagTokenName, BadgeColorTokens>;
  project: BadgeColorTokens;
  selection: BadgeColorTokens;
}

export interface TuiTheme extends ThemeColorTokens {
  name: ThemeName;
}

export interface ResolvedTuiTheme extends TuiTheme {
  mode: ThemeMode;
  colorLevel: TerminalColorLevel;
}
