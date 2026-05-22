import type { TuiTheme } from "./tokens.js";

export const daylightTheme: TuiTheme = {
  name: "daylight",
  gutterStyle: "thin",
  surface: {
    canvas: "#f6f3ea",
    panel: "#fbf8ee",
    raised: "#fdfaef",
    chrome: "#ece5d2"
  },
  text: {
    primary: "#28241b",
    secondary: "#4a4537",
    muted: "#857e6d",
    subtle: "#a8a190",
    faint: "#cfc8b5",
    onChrome: "#5d564a"
  },
  border: {
    strong: "#bdb5a0",
    default: "#dbd4c1",
    subtle: "#e8e1cc"
  },
  accent: {
    default: "#b8431a",
    soft: "#e8d2c0",
    on: "#fbf8ee"
  },
  role: {
    system: { fg: "#857e6d", gutter: "#bdb5a0" },
    user: { fg: "#0e547d", gutter: "#0e547d" },
    assistant: { fg: "#7b2c10", gutter: "#b8431a" },
    tool: { fg: "#6a4a0a", gutter: "#a17612" },
    error: { fg: "#8e2222", gutter: "#8e2222" }
  },
  status: {
    ok: "#1f5e36",
    warn: "#a17612",
    err: "#8e2222",
    info: "#0e547d"
  },
  tag: {
    review: { bg: "#d5e6f3", fg: "#0c4670" },
    wip: { bg: "#f1e1bb", fg: "#7a5b0d" },
    design: { bg: "#efd9e6", fg: "#86234a" },
    infra: { bg: "#cee8d5", fg: "#1f5e36" },
    planning: { bg: "#e1dbef", fg: "#4c2e95" },
    refactor: { bg: "#f0d6d6", fg: "#8e2222" },
    docs: { bg: "#d6e6c8", fg: "#3d5a1e" },
    inbox: { bg: "#dfd7c2", fg: "#5d564a" }
  },
  project: {
    kaleid: { bg: "#e1dbef", fg: "#4c2e95" },
    "web-app": { bg: "#d5e6f3", fg: "#0c4670" },
    research: { bg: "#f1e1bb", fg: "#7a5b0d" },
    personal: { bg: "#cee8d5", fg: "#1f5e36" }
  },
  selection: { bg: "#e8d2c0", fg: "#28241b" }
};
