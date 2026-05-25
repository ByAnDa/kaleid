import { daylightTheme } from "./daylight.js";
import { detectTerminalAppearance, detectTerminalColorLevel } from "./detect.js";
import { resolveTheme } from "./fallback.js";
import { spectrumTheme } from "./spectrum.js";
import type { ResolvedTuiTheme, TerminalAppearance, TerminalColorLevel, ThemeMode, ThemeName } from "./tokens.js";

export type {
  BadgeColorTokens,
  GutterStyle,
  ModeTokenName,
  ProjectTokenName,
  ResolvedTuiTheme,
  RoleColorTokens,
  RoleTokenName,
  StateColorTokens,
  StateTokenName,
  StatusTokenName,
  TagTokenName,
  TerminalAppearance,
  TerminalColorLevel,
  ThemeMode,
  ThemeName,
  TuiTheme
} from "./tokens.js";
export { daylightTheme } from "./daylight.js";
export { spectrumTheme } from "./spectrum.js";
export { detectTerminalAppearance, detectTerminalColorLevel } from "./detect.js";
export { nearestAnsi256Color, nearestAnsiColor, resolveThemeColor } from "./fallback.js";

export const DEFAULT_THEME_MODE: ThemeMode = "system";

export function themeNameForMode(mode: ThemeMode, appearance: TerminalAppearance): ThemeName {
  if (mode === "daylight" || mode === "spectrum") {
    return mode;
  }

  return appearance === "light" ? "daylight" : "spectrum";
}

export function getBaseTheme(name: ThemeName) {
  return name === "daylight" ? daylightTheme : spectrumTheme;
}

export function getResolvedTheme(
  mode: ThemeMode = DEFAULT_THEME_MODE,
  appearance: TerminalAppearance = detectTerminalAppearance(),
  colorLevel: TerminalColorLevel = detectTerminalColorLevel()
): ResolvedTuiTheme {
  return resolveTheme(getBaseTheme(themeNameForMode(mode, appearance)), colorLevel, mode);
}

export const DEFAULT_RESOLVED_THEME = getResolvedTheme("spectrum", "dark", "truecolor");
