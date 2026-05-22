import React from "react";
import { Text } from "ink";
import type { BadgeColorTokens, ProjectTokenName, ResolvedTuiTheme, TagTokenName } from "../theme/index.js";

const TAG_TOKENS: TagTokenName[] = ["review", "wip", "design", "infra", "planning", "refactor", "docs", "inbox"];
const PROJECT_TOKENS: ProjectTokenName[] = ["kaleid", "web-app", "research", "personal"];

function hashText(value: string): number {
  let hash = 0;
  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash;
}

export function getTagTokenName(label: string): TagTokenName {
  const normalized = label.replace(/^#/u, "").toLowerCase();
  if ((TAG_TOKENS as readonly string[]).includes(normalized)) {
    return normalized as TagTokenName;
  }

  return TAG_TOKENS[hashText(normalized) % TAG_TOKENS.length] ?? "inbox";
}

export function getProjectTokenName(project: string): ProjectTokenName {
  const normalized = project.toLowerCase();
  if ((PROJECT_TOKENS as readonly string[]).includes(normalized)) {
    return normalized as ProjectTokenName;
  }

  return PROJECT_TOKENS[hashText(normalized) % PROJECT_TOKENS.length] ?? "kaleid";
}

export function formatBadgeText(value: string, prefix = ""): string {
  const body = prefix ? `${prefix}${value.replace(/^#/u, "")}` : value;
  return ` ${body} `;
}

export function Badge({ colors, text }: { colors: BadgeColorTokens; text: string }): React.ReactElement {
  return (
    <Text backgroundColor={colors.bg} color={colors.fg}>
      {formatBadgeText(text)}
    </Text>
  );
}

export function ProjectBadge({ project, theme }: { project: string; theme: ResolvedTuiTheme }): React.ReactElement {
  return <Badge colors={theme.project[getProjectTokenName(project)]} text={project} />;
}

export function TagBadge({ label, theme }: { label: string; theme: ResolvedTuiTheme }): React.ReactElement {
  return <Badge colors={theme.tag[getTagTokenName(label)]} text={`#${label.replace(/^#/u, "")}`} />;
}
