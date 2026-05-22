import React from "react";
import { Box, Text } from "ink";
import { providerLabel, type ProviderId, type ReasoningEffort } from "../../provider/models.js";
import type { ResolvedTuiTheme } from "../theme/index.js";
import { ProjectBadge, TagBadge } from "./Badges.js";

export const HEADER_HEIGHT = 7;
const VERSION_LABEL = "v0.0.13";
export const LOGO_LINES = ["   ◆   ", "  ◆◇◆  ", " ◆◇◆◇◆ ", "  ◆◇◆  ", "   ◆   "] as const;

export interface HeaderProps {
  labels: readonly string[];
  model: string;
  name: string;
  project: string | null;
  provider?: ProviderId;
  reasoningEffort: ReasoningEffort | null;
  theme: ResolvedTuiTheme;
  width: number;
}

export function formatHeaderState(
  model: string,
  reasoningEffort: ReasoningEffort | null,
  provider?: ProviderId
): string {
  const suffix = provider ? ` ${providerLabel(provider)}` : "";
  return `${model}${suffix} · ${reasoningEffort ?? "-"}`;
}

export function truncateHeaderState(value: string, maxWidth: number): string {
  if (value.length <= maxWidth) {
    return value;
  }

  if (maxWidth <= 3) {
    return ".".repeat(Math.max(0, maxWidth));
  }

  return `${value.slice(0, maxWidth - 3)}...`;
}

export function buildWelcomeIntroText(
  model: string,
  reasoningEffort: ReasoningEffort | null,
  provider?: ProviderId
): string {
  return [
    `${LOGO_LINES[0]}  kaleid ${VERSION_LABEL} · ${formatHeaderState(model, reasoningEffort, provider)}`,
    `${LOGO_LINES[1]}  a kaleidoscopic terminal agent · multi-model · project & label scoped`,
    `${LOGO_LINES[2]}  /help · /resume · /label · ^C interrupt · ^D exit`,
    `${LOGO_LINES[3]}  terminal coding harness`,
    LOGO_LINES[4]
  ].join("\n");
}

function textLength(value: string): number {
  return Array.from(value).length;
}

function fill(width: number): string {
  return " ".repeat(Math.max(0, width));
}

function LogoLine({ line, theme }: { line: string; theme: ResolvedTuiTheme }): React.ReactElement {
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

function Kbd({ children, theme }: { children: string; theme: ResolvedTuiTheme }): React.ReactElement {
  return (
    <Text backgroundColor={theme.text.faint} color={theme.text.primary}>
      {` ${children} `}
    </Text>
  );
}

export function Header({
  labels,
  model,
  name,
  project,
  provider,
  reasoningEffort,
  theme,
  width
}: HeaderProps): React.ReactElement {
  const innerWidth = Math.max(1, width - 2);
  const maxStateWidth = Math.max(0, innerWidth - 8);
  const showState = maxStateWidth >= 10;
  const state = truncateHeaderState(formatHeaderState(model, reasoningEffort, provider), maxStateWidth);
  const visibleModel = truncateHeaderState(model, Math.max(8, width - 34));
  const visibleProvider = provider && width >= 62 ? providerLabel(provider) : "";
  const showContext = width >= 54;
  const showLabelTip = width >= 64;
  const showExitTips = width >= 78;
  const visibleName = truncateHeaderState(name, Math.max(8, Math.min(30, width - 42)));
  const visibleProject = project ? truncateHeaderState(project, 16) : null;
  const visibleLabels = labels.slice(0, 2).map((label) => ({ key: label, value: truncateHeaderState(label, 12) }));
  const titleText = "kaleid";
  const titleState = showState ? state : "";
  const titleGap = fill(innerWidth - textLength(titleText) - textLength(titleState));
  const separator = "─".repeat(Math.max(1, width));
  const logoGap = "  ";
  const rowWidthAfterLogo = Math.max(0, width - LOGO_LINES[0].length - logoGap.length - 2);

  return (
    <Box flexDirection="column" flexShrink={0} height={HEADER_HEIGHT} width={width}>
      <Box flexDirection="row" paddingX={1} width={width}>
        <Text backgroundColor={theme.surface.canvas} bold color={theme.accent.default}>
          {titleText}
        </Text>
        <Text backgroundColor={theme.surface.canvas} color={theme.text.muted}>
          {titleGap}
        </Text>
        {showState ? (
          <Text backgroundColor={theme.surface.canvas} color={theme.text.secondary}>
            {state}
          </Text>
        ) : null}
      </Box>
      <Text backgroundColor={theme.surface.canvas} color={theme.border.subtle}>
        {separator}
      </Text>
      <Box flexDirection="row" paddingX={1} width={width}>
        <LogoLine line={LOGO_LINES[0]} theme={theme} />
        <Text backgroundColor={theme.surface.canvas}>{logoGap}</Text>
        <Text backgroundColor={theme.surface.canvas} bold color={theme.accent.default}>
          kaleid
        </Text>
        <Text backgroundColor={theme.surface.canvas} color={theme.text.muted}>
          {` ${VERSION_LABEL} `}
        </Text>
        <Text backgroundColor={theme.surface.canvas} color={theme.text.faint}>
          ·
        </Text>
        <Text backgroundColor={theme.surface.canvas} color={theme.text.primary}>
          {` ${visibleModel}`}
        </Text>
        {visibleProvider ? (
          <Text backgroundColor={theme.surface.canvas} color={theme.text.muted}>
            {` ${visibleProvider}`}
          </Text>
        ) : null}
      </Box>
      <Box flexDirection="row" paddingX={1} width={width}>
        <LogoLine line={LOGO_LINES[1]} theme={theme} />
        <Text backgroundColor={theme.surface.canvas}>{logoGap}</Text>
        <Text backgroundColor={theme.surface.canvas} color={theme.text.secondary}>
          {truncateHeaderState("a kaleidoscopic terminal agent · multi-model · project & label scoped", rowWidthAfterLogo)}
        </Text>
      </Box>
      <Box flexDirection="row" paddingX={1} width={width}>
        <LogoLine line={LOGO_LINES[2]} theme={theme} />
        <Text backgroundColor={theme.surface.canvas}>{logoGap}</Text>
        <Kbd theme={theme}>/help</Kbd>
        <Text backgroundColor={theme.surface.canvas} color={theme.text.muted}>
          {" · "}
        </Text>
        <Kbd theme={theme}>/resume</Kbd>
        {showLabelTip ? (
          <>
            <Text backgroundColor={theme.surface.canvas} color={theme.text.muted}>
              {" · "}
            </Text>
            <Kbd theme={theme}>/label</Kbd>
          </>
        ) : null}
        {showExitTips ? (
          <Text backgroundColor={theme.surface.canvas} color={theme.text.muted}>
            {" · ^C interrupt · ^D exit"}
          </Text>
        ) : null}
      </Box>
      <Box flexDirection="row" paddingX={1} width={width}>
        <LogoLine line={LOGO_LINES[3]} theme={theme} />
        <Text backgroundColor={theme.surface.canvas}>{logoGap}</Text>
        {showContext ? (
          <>
            <Text backgroundColor={theme.surface.canvas} color={theme.text.muted}>
              session{" "}
            </Text>
            <Text backgroundColor={theme.surface.canvas} color={theme.text.primary}>
              {visibleName}
            </Text>
            {visibleProject ? (
              <>
                <Text backgroundColor={theme.surface.canvas}> </Text>
                <ProjectBadge project={visibleProject} theme={theme} />
              </>
            ) : null}
            {visibleLabels.map((label) => (
              <React.Fragment key={label.key}>
                <Text backgroundColor={theme.surface.canvas}> </Text>
                <TagBadge label={label.value} theme={theme} />
              </React.Fragment>
            ))}
          </>
        ) : (
          <Text backgroundColor={theme.surface.canvas} color={theme.text.muted}>
            terminal coding harness
          </Text>
        )}
      </Box>
      <Box flexDirection="row" paddingX={1} width={width}>
        <LogoLine line={LOGO_LINES[4]} theme={theme} />
        <Text backgroundColor={theme.surface.canvas} color={theme.text.faint}>
          {fill(Math.max(0, width - LOGO_LINES[4].length - 2))}
        </Text>
      </Box>
    </Box>
  );
}
