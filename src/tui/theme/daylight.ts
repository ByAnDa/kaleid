import type { TuiTheme } from "./tokens.js";

export const daylightTheme: TuiTheme = {
  name: "daylight",
  surface: {
    canvas: "#fbfaf7",
    panel: "#f2efe8",
    raised: "#ffffff",
    chrome: "#29323a"
  },
  text: {
    primary: "#202428",
    secondary: "#49535c",
    muted: "#68727c",
    subtle: "#89929a",
    faint: "#a9b0b6",
    onChrome: "#f8f4ec"
  },
  border: {
    strong: "#7f8b93",
    default: "#c4c9cb",
    subtle: "#dedbd3"
  },
  accent: {
    primary: "#0f766e",
    secondary: "#6d5bd0",
    quiet: "#dfe9e6"
  },
  role: {
    system: { fg: "#6d7580", gutter: "#a7adb4" },
    user: { fg: "#0b6f67", gutter: "#11a397" },
    assistant: { fg: "#2f5fc7", gutter: "#5b7ee5" },
    tool: { fg: "#8a4c18", gutter: "#c77725" },
    error: { fg: "#b42318", gutter: "#e5484d" }
  },
  status: {
    ok: "#15803d",
    warn: "#b45309",
    err: "#b42318",
    info: "#2563eb"
  },
  tag: {
    review: { bg: "#ffe1dc", fg: "#9f2f22" },
    wip: { bg: "#fff0c2", fg: "#795400" },
    design: { bg: "#e5dcff", fg: "#4f3ab8" },
    infra: { bg: "#d9edf6", fg: "#155a75" },
    planning: { bg: "#dcebd1", fg: "#356118" },
    refactor: { bg: "#f0d7ea", fg: "#7c2f69" },
    docs: { bg: "#dce6ff", fg: "#2752a3" },
    inbox: { bg: "#e8e1d7", fg: "#665640" }
  },
  project: { bg: "#153f4a", fg: "#f3fbfd" },
  selection: { bg: "#0f766e", fg: "#ffffff" }
};
