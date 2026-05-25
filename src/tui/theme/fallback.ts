import type {
  BadgeColorTokens,
  ResolvedTuiTheme,
  TerminalColorLevel,
  ThemeColorTokens,
  ThemeName,
  TuiTheme
} from "./tokens.js";

const ANSI16_COLORS: Record<string, string> = {
  black: "#000000",
  red: "#cd3131",
  green: "#0dbc79",
  yellow: "#e5e510",
  blue: "#2472c8",
  magenta: "#bc3fbc",
  cyan: "#11a8cd",
  white: "#e5e5e5",
  gray: "#666666"
};

const ANSI256_LEVELS = [0, 95, 135, 175, 215, 255] as const;

const ANSI16_SEMANTIC_THEMES: Record<ThemeName, ThemeColorTokens> = {
  daylight: {
    surface: {
      canvas: "white",
      panel: "white",
      raised: "white",
      chrome: "black"
    },
    text: {
      primary: "black",
      secondary: "black",
      muted: "gray",
      subtle: "gray",
      faint: "gray",
      onChrome: "white"
    },
    border: {
      strong: "gray",
      default: "gray",
      subtle: "white"
    },
    accent: {
      default: "cyan",
      soft: "white",
      on: "black"
    },
    role: {
      system: { fg: "gray", gutter: "gray" },
      user: { fg: "cyan", gutter: "cyan" },
      assistant: { fg: "blue", gutter: "blue" },
      tool: { fg: "yellow", gutter: "yellow" },
      error: { fg: "red", gutter: "red" }
    },
    status: {
      ok: "green",
      warn: "yellow",
      err: "red",
      info: "blue"
    },
    state: {
      idle: { fg: "gray", bg: "white", dot: "gray" },
      typing: { fg: "blue", bg: "white", dot: "blue" },
      thinking: { fg: "magenta", bg: "white", dot: "magenta" },
      streaming: { fg: "blue", bg: "white", dot: "blue" },
      running: { fg: "yellow", bg: "black", dot: "yellow" },
      approving: { fg: "magenta", bg: "white", dot: "magenta" },
      ok: { fg: "green", bg: "white", dot: "green" },
      err: { fg: "red", bg: "white", dot: "red" }
    },
    modePalette: {
      normal: { fg: "black", bg: "white", dot: "black" },
      plan: { fg: "magenta", bg: "white", dot: "magenta" },
      auto: { fg: "blue", bg: "white", dot: "blue" },
      readonly: { fg: "green", bg: "white", dot: "green" }
    },
    tag: {
      review: { bg: "red", fg: "white" },
      wip: { bg: "yellow", fg: "black" },
      design: { bg: "magenta", fg: "white" },
      infra: { bg: "cyan", fg: "black" },
      planning: { bg: "green", fg: "black" },
      refactor: { bg: "blue", fg: "white" },
      docs: { bg: "white", fg: "blue" },
      inbox: { bg: "gray", fg: "white" }
    },
    project: {
      kaleid: { bg: "magenta", fg: "white" },
      "web-app": { bg: "cyan", fg: "black" },
      research: { bg: "yellow", fg: "black" },
      personal: { bg: "green", fg: "black" }
    },
    selection: { bg: "cyan", fg: "black" }
  },
  spectrum: {
    surface: {
      canvas: "black",
      panel: "black",
      raised: "gray",
      chrome: "white"
    },
    text: {
      primary: "white",
      secondary: "white",
      muted: "gray",
      subtle: "gray",
      faint: "gray",
      onChrome: "black"
    },
    border: {
      strong: "gray",
      default: "gray",
      subtle: "black"
    },
    accent: {
      default: "magenta",
      soft: "black",
      on: "white"
    },
    role: {
      system: { fg: "gray", gutter: "gray" },
      user: { fg: "cyan", gutter: "cyan" },
      assistant: { fg: "blue", gutter: "blue" },
      tool: { fg: "yellow", gutter: "yellow" },
      error: { fg: "red", gutter: "red" }
    },
    status: {
      ok: "green",
      warn: "yellow",
      err: "red",
      info: "blue"
    },
    state: {
      idle: { fg: "gray", bg: "black", dot: "gray" },
      typing: { fg: "cyan", bg: "black", dot: "cyan" },
      thinking: { fg: "magenta", bg: "black", dot: "magenta" },
      streaming: { fg: "magenta", bg: "black", dot: "magenta" },
      running: { fg: "yellow", bg: "black", dot: "yellow" },
      approving: { fg: "yellow", bg: "black", dot: "yellow" },
      ok: { fg: "green", bg: "black", dot: "green" },
      err: { fg: "red", bg: "black", dot: "red" }
    },
    modePalette: {
      normal: { fg: "white", bg: "black", dot: "gray" },
      plan: { fg: "magenta", bg: "black", dot: "magenta" },
      auto: { fg: "magenta", bg: "black", dot: "magenta" },
      readonly: { fg: "green", bg: "black", dot: "green" }
    },
    tag: {
      review: { bg: "red", fg: "white" },
      wip: { bg: "yellow", fg: "black" },
      design: { bg: "magenta", fg: "white" },
      infra: { bg: "cyan", fg: "black" },
      planning: { bg: "green", fg: "black" },
      refactor: { bg: "blue", fg: "white" },
      docs: { bg: "white", fg: "blue" },
      inbox: { bg: "gray", fg: "white" }
    },
    project: {
      kaleid: { bg: "magenta", fg: "white" },
      "web-app": { bg: "cyan", fg: "black" },
      research: { bg: "yellow", fg: "black" },
      personal: { bg: "green", fg: "black" }
    },
    selection: { bg: "magenta", fg: "white" }
  }
};

function hexToRgb(hex: string): [number, number, number] | null {
  const match = /^#?([0-9a-f]{6})$/iu.exec(hex);
  if (!match) {
    return null;
  }

  const value = match[1] ?? "";
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16)
  ];
}

function distance(a: [number, number, number], b: [number, number, number]): number {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
}

export function nearestAnsiColor(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) {
    return hex;
  }

  let bestName = "white";
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const [name, fallbackHex] of Object.entries(ANSI16_COLORS)) {
    const fallbackRgb = hexToRgb(fallbackHex);
    if (!fallbackRgb) {
      continue;
    }

    const nextDistance = distance(rgb, fallbackRgb);
    if (nextDistance < bestDistance) {
      bestName = name;
      bestDistance = nextDistance;
    }
  }

  return bestName;
}

function ansi256PaletteColor(index: number): [number, number, number] {
  if (index < 16) {
    return hexToRgb(Object.values(ANSI16_COLORS)[index] ?? "#ffffff") ?? [255, 255, 255];
  }

  if (index < 232) {
    const cubeIndex = index - 16;
    const red = ANSI256_LEVELS[Math.floor(cubeIndex / 36)] ?? 0;
    const green = ANSI256_LEVELS[Math.floor((cubeIndex % 36) / 6)] ?? 0;
    const blue = ANSI256_LEVELS[cubeIndex % 6] ?? 0;
    return [red, green, blue];
  }

  const gray = 8 + (index - 232) * 10;
  return [gray, gray, gray];
}

export function nearestAnsi256Color(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) {
    return hex;
  }

  let bestIndex = 15;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index <= 255; index += 1) {
    const nextDistance = distance(rgb, ansi256PaletteColor(index));
    if (nextDistance < bestDistance) {
      bestIndex = index;
      bestDistance = nextDistance;
    }
  }

  return `ansi256(${bestIndex})`;
}

function mapBadgeColors(badge: BadgeColorTokens, colorLevel: TerminalColorLevel): BadgeColorTokens {
  return {
    bg: resolveThemeColor(badge.bg, colorLevel),
    fg: resolveThemeColor(badge.fg, colorLevel)
  };
}

function mapStateColors<T extends BadgeColorTokens & { dot: string }>(state: T, colorLevel: TerminalColorLevel): T {
  return {
    bg: resolveThemeColor(state.bg, colorLevel),
    fg: resolveThemeColor(state.fg, colorLevel),
    dot: resolveThemeColor(state.dot, colorLevel)
  } as T;
}

export function resolveThemeColor(hex: string, colorLevel: TerminalColorLevel): string {
  if (colorLevel === "truecolor") {
    return hex;
  }

  if (colorLevel === "ansi256") {
    return nearestAnsi256Color(hex);
  }

  return nearestAnsiColor(hex);
}

export function resolveTheme(theme: TuiTheme, colorLevel: TerminalColorLevel, mode: ResolvedTuiTheme["mode"]): ResolvedTuiTheme {
  if (colorLevel === "ansi16") {
    return {
      ...ANSI16_SEMANTIC_THEMES[theme.name],
      gutterStyle: theme.gutterStyle,
      name: theme.name,
      mode,
      colorLevel
    };
  }

  const map = (hex: string) => resolveThemeColor(hex, colorLevel);
  const tokens: ThemeColorTokens = {
    surface: {
      canvas: map(theme.surface.canvas),
      panel: map(theme.surface.panel),
      raised: map(theme.surface.raised),
      chrome: map(theme.surface.chrome)
    },
    text: {
      primary: map(theme.text.primary),
      secondary: map(theme.text.secondary),
      muted: map(theme.text.muted),
      subtle: map(theme.text.subtle),
      faint: map(theme.text.faint),
      onChrome: map(theme.text.onChrome)
    },
    border: {
      strong: map(theme.border.strong),
      default: map(theme.border.default),
      subtle: map(theme.border.subtle)
    },
    accent: {
      default: map(theme.accent.default),
      soft: map(theme.accent.soft),
      on: map(theme.accent.on)
    },
    role: {
      system: { fg: map(theme.role.system.fg), gutter: map(theme.role.system.gutter) },
      user: { fg: map(theme.role.user.fg), gutter: map(theme.role.user.gutter) },
      assistant: { fg: map(theme.role.assistant.fg), gutter: map(theme.role.assistant.gutter) },
      tool: { fg: map(theme.role.tool.fg), gutter: map(theme.role.tool.gutter) },
      error: { fg: map(theme.role.error.fg), gutter: map(theme.role.error.gutter) }
    },
    status: {
      ok: map(theme.status.ok),
      warn: map(theme.status.warn),
      err: map(theme.status.err),
      info: map(theme.status.info)
    },
    state: {
      idle: mapStateColors(theme.state.idle, colorLevel),
      typing: mapStateColors(theme.state.typing, colorLevel),
      thinking: mapStateColors(theme.state.thinking, colorLevel),
      streaming: mapStateColors(theme.state.streaming, colorLevel),
      running: mapStateColors(theme.state.running, colorLevel),
      approving: mapStateColors(theme.state.approving, colorLevel),
      ok: mapStateColors(theme.state.ok, colorLevel),
      err: mapStateColors(theme.state.err, colorLevel)
    },
    modePalette: {
      normal: mapStateColors(theme.modePalette.normal, colorLevel),
      plan: mapStateColors(theme.modePalette.plan, colorLevel),
      auto: mapStateColors(theme.modePalette.auto, colorLevel),
      readonly: mapStateColors(theme.modePalette.readonly, colorLevel)
    },
    tag: {
      review: mapBadgeColors(theme.tag.review, colorLevel),
      wip: mapBadgeColors(theme.tag.wip, colorLevel),
      design: mapBadgeColors(theme.tag.design, colorLevel),
      infra: mapBadgeColors(theme.tag.infra, colorLevel),
      planning: mapBadgeColors(theme.tag.planning, colorLevel),
      refactor: mapBadgeColors(theme.tag.refactor, colorLevel),
      docs: mapBadgeColors(theme.tag.docs, colorLevel),
      inbox: mapBadgeColors(theme.tag.inbox, colorLevel)
    },
    project: {
      kaleid: mapBadgeColors(theme.project.kaleid, colorLevel),
      "web-app": mapBadgeColors(theme.project["web-app"], colorLevel),
      research: mapBadgeColors(theme.project.research, colorLevel),
      personal: mapBadgeColors(theme.project.personal, colorLevel)
    },
    selection: mapBadgeColors(theme.selection, colorLevel)
  };

  return {
    ...tokens,
    gutterStyle: theme.gutterStyle,
    name: theme.name,
    mode,
    colorLevel
  };
}
