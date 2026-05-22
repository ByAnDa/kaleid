import type { TuiTheme } from "./tokens.js";

export const spectrumTheme: TuiTheme = {
  name: "spectrum",
  surface: {
    canvas: "#111316",
    panel: "#181b20",
    raised: "#20252b",
    chrome: "#e8edf2"
  },
  text: {
    primary: "#eef2f5",
    secondary: "#c2cbd3",
    muted: "#8d99a5",
    subtle: "#67727f",
    faint: "#48515d",
    onChrome: "#111316"
  },
  border: {
    strong: "#75808c",
    default: "#3a424c",
    subtle: "#262c33"
  },
  accent: {
    primary: "#37d3c3",
    secondary: "#a78bfa",
    quiet: "#143a3a"
  },
  role: {
    system: { fg: "#9aa5b1", gutter: "#5c6671" },
    user: { fg: "#5eead4", gutter: "#14b8a6" },
    assistant: { fg: "#93c5fd", gutter: "#4f8ff7" },
    tool: { fg: "#fbbf77", gutter: "#f59e0b" },
    error: { fg: "#fb7185", gutter: "#f43f5e" }
  },
  status: {
    ok: "#4ade80",
    warn: "#fbbf24",
    err: "#fb7185",
    info: "#60a5fa"
  },
  tag: {
    review: { bg: "#5f2626", fg: "#ffd6d6" },
    wip: { bg: "#624a14", fg: "#ffe8a3" },
    design: { bg: "#3b2f75", fg: "#e6ddff" },
    infra: { bg: "#16485d", fg: "#caedfb" },
    planning: { bg: "#294d23", fg: "#d9f8cb" },
    refactor: { bg: "#5a2a55", fg: "#ffd8f7" },
    docs: { bg: "#283d78", fg: "#dbe7ff" },
    inbox: { bg: "#3d4650", fg: "#e6ebef" }
  },
  project: { bg: "#37d3c3", fg: "#081312" },
  selection: { bg: "#37d3c3", fg: "#071615" }
};
