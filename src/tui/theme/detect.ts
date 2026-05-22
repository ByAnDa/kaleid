import type { TerminalAppearance, TerminalColorLevel } from "./tokens.js";

export function detectTerminalAppearance(env: NodeJS.ProcessEnv = process.env): TerminalAppearance {
  const colorFgBg = env.COLORFGBG;
  if (colorFgBg) {
    const parts = colorFgBg.split(";");
    const bg = Number.parseInt(parts.at(-1) ?? "", 10);
    if (Number.isFinite(bg)) {
      if (bg === 7 || bg === 15 || (bg >= 230 && bg <= 255)) {
        return "light";
      }
      if ((bg >= 0 && bg <= 6) || bg === 8 || (bg >= 16 && bg <= 59)) {
        return "dark";
      }
    }
  }

  const termProgram = `${env.TERM_PROGRAM ?? ""} ${env.TERM ?? ""}`.toLowerCase();
  if (termProgram.includes("linux")) {
    return "dark";
  }

  return "dark";
}

export function detectTerminalColorLevel(env: NodeJS.ProcessEnv = process.env): TerminalColorLevel {
  if (/\b(truecolor|24bit)\b/iu.test(env.COLORTERM ?? "")) {
    return "truecolor";
  }

  if (/\b(24bit|truecolor|direct)\b/iu.test(env.TERM ?? "")) {
    return "truecolor";
  }

  if (env.TERM?.includes("256color")) {
    return "ansi256";
  }

  return "ansi16";
}
