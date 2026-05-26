import React from "react";
import { Box, Text } from "ink";
import { providerLabel, type ProviderId, type ReasoningEffort } from "../../provider/models.js";
import type { ResolvedTuiTheme } from "../theme/index.js";
import { textWidth, truncateEnd } from "./text-width.js";

export const VERSION_LABEL = "v0.0.16";
export const LOGO_LINES = ["   ◆   ", "  ◆◇◆  ", " ◆◇◆◇◆ ", "  ◆◇◆  ", "   ◆   "] as const;
export const WELCOME_BANNER_ROWS = LOGO_LINES.length;

export interface WelcomeBannerState {
  model: string;
  provider?: ProviderId;
  reasoningEffort: ReasoningEffort | null;
}

export interface WelcomeBannerRow {
  logo: string;
  text: string;
  tone: "title" | "body" | "tips" | "muted";
}

export function formatWelcomeBannerState({
  model,
  provider,
  reasoningEffort
}: WelcomeBannerState): string {
  const suffix = provider ? ` ${providerLabel(provider)}` : "";
  return `${model}${suffix} · ${reasoningEffort ?? "-"}`;
}

export function buildWelcomeIntroText(
  model: string,
  reasoningEffort: ReasoningEffort | null,
  provider?: ProviderId
): string {
  return buildWelcomeBannerRows({ model, provider, reasoningEffort }, 120)
    .map((row) => `${row.logo}  ${row.text}`.trimEnd())
    .join("\n");
}

export function buildWelcomeBannerRows(state: WelcomeBannerState, width: number): WelcomeBannerRow[] {
  const innerWidth = Math.max(1, width - 2);
  const logoGap = 2;
  const textAreaWidth = Math.max(0, innerWidth - textWidth(LOGO_LINES[0]) - logoGap);
  const modelState = formatWelcomeBannerState(state);

  return [
    {
      logo: LOGO_LINES[0],
      text: truncateEnd(`kaleid ${VERSION_LABEL} · ${modelState}`, textAreaWidth),
      tone: "title"
    },
    {
      logo: LOGO_LINES[1],
      text: truncateEnd("a kaleidoscopic terminal agent · multi-model · project & label scoped", textAreaWidth),
      tone: "body"
    },
    {
      logo: LOGO_LINES[2],
      text: truncateEnd("/help · /resume · /label · ^C interrupt · ^D exit", textAreaWidth),
      tone: "tips"
    },
    {
      logo: LOGO_LINES[3],
      text: truncateEnd("terminal coding harness", textAreaWidth),
      tone: "muted"
    },
    {
      logo: LOGO_LINES[4],
      text: "",
      tone: "muted"
    }
  ];
}

export function LogoLine({ line, theme }: { line: string; theme: ResolvedTuiTheme }): React.ReactElement {
  return (
    <Text backgroundColor={theme.surface.canvas}>
      {Array.from(line).map((char, index) => (
        <Text
          key={`${char}-${index}`}
          backgroundColor={theme.surface.canvas}
          color={char === "◇" ? theme.text.muted : theme.accent.default}
        >
          {char}
        </Text>
      ))}
    </Text>
  );
}

export function Kbd({ children, theme }: { children: string; theme: ResolvedTuiTheme }): React.ReactElement {
  return (
    <Text backgroundColor={theme.text.faint} color={theme.text.primary}>
      {` ${children} `}
    </Text>
  );
}

function colorForTone(row: WelcomeBannerRow, theme: ResolvedTuiTheme): string {
  if (row.tone === "title") {
    return theme.text.primary;
  }
  if (row.tone === "body") {
    return theme.text.secondary;
  }
  if (row.tone === "tips") {
    return theme.text.muted;
  }
  return theme.text.faint;
}

export function WelcomeBanner({
  maxRows,
  model,
  provider,
  reasoningEffort,
  theme,
  width
}: WelcomeBannerState & {
  maxRows?: number;
  theme: ResolvedTuiTheme;
  width: number;
}): React.ReactElement {
  const rows = buildWelcomeBannerRows({ model, provider, reasoningEffort }, width).slice(
    0,
    Math.max(0, maxRows ?? WELCOME_BANNER_ROWS)
  );
  const innerWidth = Math.max(1, width - 2);
  const logoGap = "  ";
  const textAreaWidth = Math.max(0, innerWidth - textWidth(LOGO_LINES[0]) - textWidth(logoGap));

  return (
    <Box flexDirection="column" width={width}>
      {rows.map((row, index) => {
        const fill = " ".repeat(Math.max(0, textAreaWidth - textWidth(row.text)));
        return (
          <Box key={index} flexDirection="row" paddingX={1} width={width}>
            <LogoLine line={row.logo} theme={theme} />
            <Text backgroundColor={theme.surface.canvas}>{logoGap}</Text>
            <Text
              backgroundColor={theme.surface.canvas}
              bold={row.tone === "title"}
              color={colorForTone(row, theme)}
            >
              {row.text}
              {fill}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}
