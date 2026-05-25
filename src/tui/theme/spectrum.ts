import type { TuiTheme } from "./tokens.js";

export const spectrumTheme: TuiTheme = {
  name: "spectrum",
  gutterStyle: "thin",
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
  state: {
    idle: { fg: "#8a8598", bg: "#1a1a28", dot: "#706c80" },
    typing: { fg: "#67e8f9", bg: "#0b2a3a", dot: "#06b6d4" },
    thinking: { fg: "#d8b4fe", bg: "#2a1448", dot: "#a855f7" },
    streaming: { fg: "#fbcfe8", bg: "#3a1130", dot: "#ec4899" },
    running: { fg: "#fde047", bg: "#3a2a08", dot: "#eab308" },
    approving: { fg: "#fdba74", bg: "#3a2008", dot: "#f97316" },
    ok: { fg: "#6ee7b7", bg: "#0a2a20", dot: "#10b981" },
    err: { fg: "#fca5a5", bg: "#3a0c0c", dot: "#ef4444" }
  },
  modePalette: {
    normal: { fg: "#e6e3f0", bg: "#1c1c2e", dot: "#a8a3c0" },
    plan: { fg: "#d8b4fe", bg: "#2a1448", dot: "#a855f7" },
    auto: { fg: "#fbcfe8", bg: "#3a1130", dot: "#ec4899" },
    readonly: { fg: "#6ee7b7", bg: "#0a2a20", dot: "#10b981" }
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
