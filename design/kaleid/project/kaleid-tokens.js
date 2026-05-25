// kaleid · design tokens — single source of truth.
// Two modes (light = Daylight, dark = Spectrum). Mode-independent tokens
// (typography, space, radius, gutter widths) sit at the top level.
//
// Naming follows a semantic-first scheme: tokens describe role, not raw colors.
// e.g. color.role.user.fg, color.tag.review.bg, not "color.cyan-500".
// The TUI screens consume these through tui-themes.jsx (which flattens the
// tree into the legacy theme shape the screens were built against).

const KALEID_TOKENS = {

  // ── Typography ──────────────────────────────────────────────────────────
  font: {
    family: {
      mono: '"JetBrains Mono", "IBM Plex Mono", "SF Mono", ui-monospace, monospace',
      ui:   '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
    },
    size: { xs: 11, sm: 12, md: 14, lg: 16, xl: 18, '2xl': 22 },
    weight: { regular: 400, medium: 500, semibold: 600, bold: 700 },
    lineHeight: { tight: 1.3, snug: 1.45, normal: 1.55, relaxed: 1.7 },
    letterSpacing: { tight: '-0.01em', normal: '0em', loose: '0.02em' },
  },

  // ── Spacing (px) — multiples used across padding, margin, gap ─────────
  space: {
    0: 0, 1: 2, 2: 4, 3: 6, 4: 8, 5: 12, 6: 16, 7: 20, 8: 24, 9: 32, 10: 40, 11: 48,
  },

  // ── Radius (px) — borders & badges ──────────────────────────────────────
  radius: { none: 0, xs: 2, sm: 3, md: 4, lg: 6, full: 9999 },

  // ── Gutter (px) — role color bar widths in chat rows ────────────────────
  gutter: { thin: 2, block: 8 },

  // ── Mode-specific palettes ──────────────────────────────────────────────
  modes: {

    light: {
      name: 'Daylight',
      desc: 'warm parchment background, ink-on-paper text',
      gutterStyle: 'bar',

      color: {
        surface: {
          canvas: '#f6f3ea',  // main bg (parchment)
          panel:  '#fbf8ee',  // header bar / raised inner panels
          raised: '#fdfaef',  // tool-call output panel
          chrome: '#ece5d2',  // OS window tab bar
        },
        text: {
          primary:   '#28241b',  // body
          secondary: '#4a4537',  // labels, headings
          muted:     '#857e6d',  // metadata, hints
          subtle:    '#a8a190',  // very low-emphasis
          faint:     '#cfc8b5',  // separators, placeholders
          onChrome:  '#5d564a',  // text on chrome tab bar
        },
        border: {
          strong:  '#bdb5a0',
          default: '#dbd4c1',
          subtle:  '#e8e1cc',
        },
        accent: {
          default: '#b8431a',  // burnt orange
          soft:    '#e8d2c0',
          on:      '#fbf8ee',
        },
        role: {
          system:    { fg: '#857e6d', gutter: '#bdb5a0' },
          user:      { fg: '#0e547d', gutter: '#0e547d' },
          assistant: { fg: '#7b2c10', gutter: '#b8431a' },
          tool:      { fg: '#6a4a0a', gutter: '#a17612' },
        },
        status: {
          ok:   '#1f5e36',
          warn: '#a17612',
          err:  '#8e2222',
          info: '#0e547d',
        },
        tag: {
          review:   { bg: '#d5e6f3', fg: '#0c4670' },
          wip:      { bg: '#f1e1bb', fg: '#7a5b0d' },
          design:   { bg: '#efd9e6', fg: '#86234a' },
          infra:    { bg: '#cee8d5', fg: '#1f5e36' },
          planning: { bg: '#e1dbef', fg: '#4c2e95' },
          refactor: { bg: '#f0d6d6', fg: '#8e2222' },
          docs:     { bg: '#d6e6c8', fg: '#3d5a1e' },
          inbox:    { bg: '#dfd7c2', fg: '#5d564a' },
        },
        project: {
          kaleid:    { bg: '#e1dbef', fg: '#4c2e95' },
          'web-app': { bg: '#d5e6f3', fg: '#0c4670' },
          research:  { bg: '#f1e1bb', fg: '#7a5b0d' },
          personal:  { bg: '#cee8d5', fg: '#1f5e36' },
        },
        selection: { bg: '#e8d2c0', fg: '#28241b' },

        // semantic state colors (per-state pills/borders)
        state: {
          idle:        { fg: '#857e6d', bg: '#ece5d2', dot: '#a8a190' },
          typing:      { fg: '#0c4670', bg: '#d5e6f3', dot: '#0e547d' },
          thinking:    { fg: '#4c2e95', bg: '#e1dbef', dot: '#7a5af5' },
          streaming:   { fg: '#7b2c10', bg: '#f0d8c4', dot: '#b8431a' },
          running:     { fg: '#7a5b0d', bg: '#f1e1bb', dot: '#a17612' },
          approving:   { fg: '#86234a', bg: '#efd9e6', dot: '#c1408a' },
          ok:          { fg: '#1f5e36', bg: '#cee8d5', dot: '#1f5e36' },
          err:         { fg: '#8e2222', bg: '#f0d6d6', dot: '#8e2222' },
        },

        // input composer modes
        mode: {
          normal: { fg: '#28241b', bg: '#ece5d2', dot: '#28241b' },
          plan:   { fg: '#4c2e95', bg: '#e1dbef', dot: '#7a5af5' },
          auto:   { fg: '#b8431a', bg: '#f0d8c4', dot: '#b8431a' },
          readonly:{ fg: '#1f5e36', bg: '#cee8d5', dot: '#1f5e36' },
        },
      },
    },

    dark: {
      name: 'Spectrum',
      desc: 'deep ink with high-chroma role gutters',
      gutterStyle: 'block',

      color: {
        surface: {
          canvas: '#0b0b14',
          panel:  '#0e0e1a',
          raised: '#15152a',
          chrome: '#1a1a28',
        },
        text: {
          primary:   '#e6e3f0',
          secondary: '#a8a3c0',
          muted:     '#706c80',
          subtle:    '#4a4660',
          faint:     '#26243a',
          onChrome:  '#94909e',
        },
        border: {
          strong:  '#2a283e',
          default: '#1c1c2e',
          subtle:  '#22203a',
        },
        accent: {
          default: '#ec4899',  // hot pink
          soft:    '#4a1d35',
          on:      '#0b0b14',
        },
        role: {
          system:    { fg: '#8a8598', gutter: '#3a3550' },
          user:      { fg: '#67e8f9', gutter: '#06b6d4' },
          assistant: { fg: '#d8b4fe', gutter: '#a855f7' },
          tool:      { fg: '#fde047', gutter: '#eab308' },
        },
        status: {
          ok:   '#6ee7b7',
          warn: '#fde047',
          err:  '#fca5a5',
          info: '#67e8f9',
        },
        tag: {
          review:   { bg: '#0b4456', fg: '#a5f3fc' },
          wip:      { bg: '#4a3a0a', fg: '#fde047' },
          design:   { bg: '#3a1456', fg: '#d8b4fe' },
          infra:    { bg: '#0a3a2e', fg: '#6ee7b7' },
          planning: { bg: '#561234', fg: '#fbcfe8' },
          refactor: { bg: '#56120e', fg: '#fca5a5' },
          docs:     { bg: '#173d22', fg: '#bef264' },
          inbox:    { bg: '#272538', fg: '#a8a3c0' },
        },
        project: {
          kaleid:    { bg: '#3a1456', fg: '#d8b4fe' },
          'web-app': { bg: '#0b3a52', fg: '#67e8f9' },
          research:  { bg: '#4a2a0e', fg: '#fdba74' },
          personal:  { bg: '#0c3a26', fg: '#86efac' },
        },
        selection: { bg: '#2a1d44', fg: '#e6e3f0' },

        state: {
          idle:      { fg: '#8a8598', bg: '#1a1a28', dot: '#706c80' },
          typing:    { fg: '#67e8f9', bg: '#0b2a3a', dot: '#06b6d4' },
          thinking:  { fg: '#d8b4fe', bg: '#2a1448', dot: '#a855f7' },
          streaming: { fg: '#fbcfe8', bg: '#3a1130', dot: '#ec4899' },
          running:   { fg: '#fde047', bg: '#3a2a08', dot: '#eab308' },
          approving: { fg: '#fdba74', bg: '#3a2008', dot: '#f97316' },
          ok:        { fg: '#6ee7b7', bg: '#0a2a20', dot: '#10b981' },
          err:       { fg: '#fca5a5', bg: '#3a0c0c', dot: '#ef4444' },
        },

        mode: {
          normal:   { fg: '#e6e3f0', bg: '#1c1c2e', dot: '#a8a3c0' },
          plan:     { fg: '#d8b4fe', bg: '#2a1448', dot: '#a855f7' },
          auto:     { fg: '#fbcfe8', bg: '#3a1130', dot: '#ec4899' },
          readonly: { fg: '#6ee7b7', bg: '#0a2a20', dot: '#10b981' },
        },
      },
    },

  },
};

// ── Adapter: flatten a mode's tokens into the theme shape consumed by
// tui-screens.jsx. Existing screens read fields like `bg`, `roles.you.fg`,
// `labels.review.bg`. This keeps the screens unchanged.
function themeFromTokens(modeKey) {
  const m = KALEID_TOKENS.modes[modeKey];
  const c = m.color;
  return {
    key: modeKey,
    name: m.name,
    blurb: m.desc,
    // surfaces
    bg:        c.surface.canvas,
    panel:     c.surface.panel,
    chrome:    c.surface.chrome,
    chromeFg:  c.text.onChrome,
    // text
    fg:        c.text.primary,
    dim:       c.text.muted,
    faint:     c.text.faint,
    // accent + borders
    accent:     c.accent.default,
    accentSoft: c.accent.soft,
    border:    c.border.default,
    rule:      c.border.subtle,
    // roles (screens use legacy keys: system, you, kaleid, tool)
    roles: {
      system: c.role.system,
      you:    c.role.user,
      kaleid: c.role.assistant,
      tool:   c.role.tool,
    },
    labels:   c.tag,
    projects: c.project,
    selectionBg: c.selection.bg,
    selectionFg: c.selection.fg,
    state: c.state,
    modePalette: c.mode,
    gutterStyle: m.gutterStyle,
    boxDrawing:  'minimal',
    // raw token bag (for any future component that wants it)
    tokens: KALEID_TOKENS,
    mode: modeKey,
  };
}

window.KALEID_TOKENS = KALEID_TOKENS;
window.themeFromTokens = themeFromTokens;
