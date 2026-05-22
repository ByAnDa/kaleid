import type { TuiTheme } from "./tokens.js";

export const spectrumTheme: TuiTheme = {
  name: "spectrum",
  gutterStyle: "block",
  surface: {
    canvas: "#0b0b14",
    panel: "#0e0e1a",
    raised: "#15152a",
    chrome: "#1a1a28"
  },
  text: {
    primary: "#e6e3f0",
    secondary: "#a8a3c0",
    muted: "#706c80",
    subtle: "#4a4660",
    faint: "#26243a",
    onChrome: "#94909e"
  },
  border: {
    strong: "#2a283e",
    default: "#1c1c2e",
    subtle: "#22203a"
  },
  accent: {
    default: "#ec4899",
    soft: "#4a1d35",
    on: "#0b0b14"
  },
  role: {
    system: { fg: "#8a8598", gutter: "#3a3550" },
    user: { fg: "#67e8f9", gutter: "#06b6d4" },
    assistant: { fg: "#d8b4fe", gutter: "#a855f7" },
    tool: { fg: "#fde047", gutter: "#eab308" },
    error: { fg: "#fca5a5", gutter: "#fca5a5" }
  },
  status: {
    ok: "#6ee7b7",
    warn: "#fde047",
    err: "#fca5a5",
    info: "#67e8f9"
  },
  tag: {
    review: { bg: "#0b4456", fg: "#a5f3fc" },
    wip: { bg: "#4a3a0a", fg: "#fde047" },
    design: { bg: "#3a1456", fg: "#d8b4fe" },
    infra: { bg: "#0a3a2e", fg: "#6ee7b7" },
    planning: { bg: "#561234", fg: "#fbcfe8" },
    refactor: { bg: "#56120e", fg: "#fca5a5" },
    docs: { bg: "#173d22", fg: "#bef264" },
    inbox: { bg: "#272538", fg: "#a8a3c0" }
  },
  project: {
    kaleid: { bg: "#3a1456", fg: "#d8b4fe" },
    "web-app": { bg: "#0b3a52", fg: "#67e8f9" },
    research: { bg: "#4a2a0e", fg: "#fdba74" },
    personal: { bg: "#0c3a26", fg: "#86efac" }
  },
  selection: { bg: "#2a1d44", fg: "#e6e3f0" }
};
