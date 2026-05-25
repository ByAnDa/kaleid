// kaleid TUI v2 — state-driven screens
// Distinct UI states surfaced from real TUI agent research:
//   idle / typing / thinking / streaming / tool-running / awaiting-approval /
//   ok / err / interrupted / plan-mode
//
// Layout, top → bottom:
//   1. WindowChrome  (OS terminal tab bar)
//   2. SessionHeader (kaleid · session name · model · context bar)
//   3. ConversationPane (message rows: user / assistant / thinking / tool / approval / plan / error / system)
//   4. InputComposer (the prominent input region; multiline + mode pill + footer)
//   5. StatusBar (project · labels · keys · time)
//
// All exported as window.ChatScreen / window.ResumeScreen for the canvas.

const MONO = '"JetBrains Mono", "IBM Plex Mono", "SF Mono", ui-monospace, monospace';

// ─────────────────────────────────────────────────────────────────────────
// Window chrome (OS terminal)
// ─────────────────────────────────────────────────────────────────────────
function WindowChrome({ theme }) {
  return (
    <div style={{
      background: theme.chrome, color: theme.chromeFg,
      height: 34, display: 'flex', alignItems: 'stretch', flexShrink: 0,
      fontSize: 12, borderBottom: '1px solid ' + theme.border,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', padding: '0 14px', gap: 10,
        background: theme.bg, borderRight: '1px solid ' + theme.border,
        minWidth: 280,
      }}>
        <DiamondGlyph theme={theme} size={10} />
        <span style={{ color: theme.fg }}>kaleid</span>
        <span style={{ color: theme.dim }}>·</span>
        <span style={{ color: theme.dim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>~/work/kaleid</span>
        <span style={{ flex: 1 }} />
        <span style={{ color: theme.dim, fontSize: 10 }}>✕</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px', color: theme.dim, fontSize: 14 }}>＋</div>
      <div style={{ flex: 1 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '0 18px', color: theme.dim, fontSize: 12 }}>
        <span>—</span><span>▢</span><span>✕</span>
      </div>
    </div>
  );
}

function DiamondGlyph({ theme, size = 14 }) {
  return (
    <span style={{
      display: 'inline-block', width: size, height: size,
      transform: 'rotate(45deg)',
      background: 'linear-gradient(135deg, ' + theme.accent + ' 0%, ' + theme.roles.you.gutter + ' 50%, ' + theme.roles.kaleid.gutter + ' 100%)',
    }} />
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Session header — name, model, context bar, state pill
// ─────────────────────────────────────────────────────────────────────────
function StatePill({ theme, state }) {
  const s = theme.state[state] || theme.state.idle;
  const labels = {
    idle: 'idle', typing: 'typing', thinking: 'thinking',
    streaming: 'streaming', running: 'running', approving: 'awaiting approval',
    ok: 'ready', err: 'error',
  };
  const pulse = ['thinking', 'streaming', 'running', 'approving'].includes(state);
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 7,
      background: s.bg, color: s.fg,
      padding: '3px 10px 3px 8px', borderRadius: 3,
      fontSize: 11, letterSpacing: '0.04em',
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: 9999, background: s.dot,
        boxShadow: pulse ? `0 0 0 3px ${s.dot}33` : 'none',
      }} />
      <span style={{ textTransform: 'uppercase' }}>{labels[state]}</span>
    </span>
  );
}

function ContextBar({ theme, used, total }) {
  const pct = Math.min(1, used / total);
  const k = (n) => n >= 1000 ? (n / 1000).toFixed(1) + 'K' : String(n);
  // 24 segment blocks for retro feel
  const N = 24;
  const filled = Math.round(pct * N);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: theme.dim, fontSize: 11 }}>
      <span style={{ color: theme.fg }}>ctx</span>
      <span style={{ fontFamily: MONO, letterSpacing: '-0.05em' }}>
        {Array.from({ length: N }).map((_, i) => (
          <span key={i} style={{ color: i < filled ? theme.accent : theme.faint }}>{i < filled ? '▰' : '▱'}</span>
        ))}
      </span>
      <span style={{ color: theme.fg }}>{k(used)}<span style={{ color: theme.dim }}>/{k(total)}</span></span>
      <span style={{ color: theme.dim }}>· {(pct * 100).toFixed(1)}%</span>
    </span>
  );
}

function SessionHeader({ theme, sessionName, project, labels, model, state, used, total }) {
  return (
    <div style={{
      padding: '10px 22px',
      borderBottom: '1px solid ' + theme.rule,
      background: theme.panel,
      display: 'flex', alignItems: 'center', gap: 18, flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <span style={{ color: theme.dim, fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase' }}>session</span>
        <span style={{ color: theme.fg, fontWeight: 500 }}>{sessionName}</span>
        <ProjectChip theme={theme} name={project} />
        {labels.map(l => <LabelChip key={l} theme={theme} name={l} />)}
      </div>
      <span style={{ flex: 1 }} />
      <StatePill theme={theme} state={state} />
      <span style={{ color: theme.faint }}>│</span>
      <ContextBar theme={theme} used={used} total={total} />
      <span style={{ color: theme.faint }}>│</span>
      <span style={{ color: theme.dim, fontSize: 11 }}>
        model <span style={{ color: theme.fg }}>{model}</span>
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Chips (labels, projects)
// ─────────────────────────────────────────────────────────────────────────
function LabelChip({ theme, name }) {
  const c = theme.labels[name] || theme.labels.inbox;
  return <span style={{
    background: c.bg, color: c.fg,
    padding: '1px 7px', borderRadius: 3,
    fontSize: 11, letterSpacing: '0.02em',
  }}>#{name}</span>;
}

function ProjectChip({ theme, name }) {
  const c = theme.projects[name] || { bg: theme.faint, fg: theme.fg };
  return <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 5,
    background: c.bg, color: c.fg,
    padding: '1px 8px 1px 6px', borderRadius: 3,
    fontSize: 11, letterSpacing: '0.02em',
  }}>
    <span style={{ width: 5, height: 5, borderRadius: 9999, background: c.fg }} />
    {name}
  </span>;
}

// ─────────────────────────────────────────────────────────────────────────
// Conversation rows (one per message kind)
// ─────────────────────────────────────────────────────────────────────────

// Generic row. Each kind decorates differently.
function MsgRow({ theme, role, label, badge, children, dim = false }) {
  const r = theme.roles[role];
  const isBlock = theme.gutterStyle === 'block';
  return (
    <div style={{ display: 'flex', alignItems: 'stretch', gap: 0, padding: '4px 0' }}>
      <div style={{
        width: isBlock ? 6 : 2,
        background: isBlock ? r.gutter : r.gutter,
        marginRight: 14, flexShrink: 0,
      }} />
      <div style={{ width: 80, flexShrink: 0, paddingTop: 2 }}>
        <div style={{ color: r.fg, fontWeight: 500, fontSize: 12 }}>{label}</div>
        {badge && <div style={{ marginTop: 4 }}>{badge}</div>}
      </div>
      <div style={{ flex: 1, color: dim ? theme.dim : theme.fg, minWidth: 0 }}>{children}</div>
    </div>
  );
}

function UserMsg({ theme, children }) {
  return <MsgRow theme={theme} role="you" label="you ›">{children}</MsgRow>;
}

function AssistantMsg({ theme, children }) {
  return <MsgRow theme={theme} role="kaleid" label="kaleid ›">{children}</MsgRow>;
}

function SystemMsg({ theme, children }) {
  return <MsgRow theme={theme} role="system" label="system" dim>{children}</MsgRow>;
}

// Thinking block — a folded "internal reasoning" panel, common in DeepSeek/Claude.
function ThinkingBlock({ theme, durationMs, expanded = false, text }) {
  return (
    <MsgRow theme={theme} role="kaleid" label="kaleid ›" badge={<span style={{ color: theme.state.thinking.fg, fontSize: 10 }}>thinking</span>}>
      <div style={{
        background: theme.state.thinking.bg + '40',
        border: '1px dashed ' + theme.state.thinking.dot + '66',
        borderRadius: 3, padding: '8px 12px',
        color: theme.state.thinking.fg, fontSize: 12, fontStyle: 'italic',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: expanded ? 6 : 0 }}>
          <span>{expanded ? '▾' : '▸'}</span>
          <span>internal reasoning · {(durationMs / 1000).toFixed(1)}s</span>
          {!expanded && <span style={{ color: theme.dim, marginLeft: 'auto', fontStyle: 'normal' }}>⏎ to expand</span>}
        </div>
        {expanded && <div style={{ whiteSpace: 'pre-wrap' }}>{text}</div>}
      </div>
    </MsgRow>
  );
}

// Tool call card — header row + (when expanded) diff/output panel
function ToolCard({ theme, name, args, status, durationMs, summary, diff, expanded = false }) {
  const stateKey = status === 'running' ? 'running' : status === 'ok' ? 'ok' : status === 'err' ? 'err' : 'idle';
  const sc = theme.state[stateKey];
  const glyph = status === 'running' ? '◐' : status === 'ok' ? '✓' : status === 'err' ? '✗' : '·';
  return (
    <MsgRow theme={theme} role="tool" label="tool ›">
      <div style={{
        background: theme.panel,
        border: '1px solid ' + theme.rule,
        borderRadius: 3, overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px',
          borderBottom: expanded ? '1px solid ' + theme.rule : 'none',
        }}>
          <span style={{ color: theme.roles.tool.fg, width: '1.4ch' }}>{expanded ? '▾' : '▸'}</span>
          <span style={{ color: theme.roles.tool.fg, fontWeight: 500 }}>{name}</span>
          <span style={{ color: theme.dim }}>(</span>
          <span style={{ color: theme.fg, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '36ch' }}>{args}</span>
          <span style={{ color: theme.dim }}>)</span>
          <span style={{ flex: 1 }} />
          <span style={{ color: theme.dim, fontSize: 11 }}>{(durationMs / 1000).toFixed(2)}s</span>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            background: sc.bg, color: sc.fg,
            padding: '1px 8px', borderRadius: 3, fontSize: 11, letterSpacing: '0.02em',
          }}>
            <span>{glyph}</span><span>{summary}</span>
          </span>
        </div>
        {expanded && diff && (
          <pre style={{
            margin: 0, padding: '10px 14px', background: theme.bg,
            color: theme.fg, fontSize: 12, lineHeight: 1.5, whiteSpace: 'pre',
            maxHeight: 200, overflow: 'hidden',
          }}>{diff}</pre>
        )}
      </div>
    </MsgRow>
  );
}

// Approval gate — Codex-style: dangerous tool waiting for user yes/no
function ApprovalCard({ theme, command, risk = 'edits files', summary }) {
  const sc = theme.state.approving;
  return (
    <MsgRow theme={theme} role="tool" label="approve" badge={<StatePillCompact theme={theme} text="awaiting" state="approving" />}>
      <div style={{
        background: sc.bg + '55',
        border: '1px solid ' + sc.dot,
        borderRadius: 3, overflow: 'hidden',
      }}>
        <div style={{ padding: '8px 14px', borderBottom: '1px solid ' + sc.dot + '55' }}>
          <div style={{ color: sc.fg, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>permission required · {risk}</div>
          <div style={{ color: theme.fg, fontFamily: MONO }}>{command}</div>
          {summary && <div style={{ color: theme.dim, fontSize: 12, marginTop: 4 }}>{summary}</div>}
        </div>
        <div style={{
          display: 'flex', gap: 0, alignItems: 'stretch',
          background: theme.bg,
        }}>
          <ApproveBtn theme={theme} kbd="y" label="approve"     primary />
          <ApproveBtn theme={theme} kbd="a" label="approve all" />
          <ApproveBtn theme={theme} kbd="e" label="edit" />
          <ApproveBtn theme={theme} kbd="n" label="deny"        danger />
        </div>
      </div>
    </MsgRow>
  );
}

function StatePillCompact({ theme, text, state }) {
  const s = theme.state[state];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: s.bg, color: s.fg,
      padding: '1px 6px', borderRadius: 2, fontSize: 10,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: 9999, background: s.dot, boxShadow: `0 0 0 2px ${s.dot}33` }} />
      {text}
    </span>
  );
}

function ApproveBtn({ theme, kbd, label, primary, danger }) {
  const c = danger ? theme.state.err.fg : primary ? theme.accent : theme.fg;
  return (
    <div style={{
      flex: 1, padding: '8px 10px',
      borderRight: '1px solid ' + theme.rule,
      display: 'flex', alignItems: 'center', gap: 8,
      cursor: 'default',
    }}>
      <span style={{
        background: c + '22', color: c,
        padding: '1px 7px', borderRadius: 2,
        fontSize: 11, fontWeight: 600,
      }}>{kbd}</span>
      <span style={{ color: c, fontSize: 12 }}>{label}</span>
    </div>
  );
}

// Plan card — Codex-style checklist of steps
function PlanCard({ theme, steps }) {
  return (
    <MsgRow theme={theme} role="kaleid" label="plan ›" badge={<StatePillCompact theme={theme} text="plan mode" state="thinking" />}>
      <div style={{
        background: theme.state.thinking.bg + '33',
        border: '1px solid ' + theme.state.thinking.dot + '55',
        borderRadius: 3, padding: '10px 14px',
      }}>
        {steps.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '3px 0', color: theme.fg, fontSize: 13 }}>
            <span style={{
              flexShrink: 0, width: 16, height: 16,
              border: '1px solid ' + (s.done ? theme.state.ok.dot : theme.dim),
              background: s.done ? theme.state.ok.dot : 'transparent',
              color: s.done ? theme.state.ok.bg : 'transparent',
              borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, marginTop: 1,
            }}>{s.done ? '✓' : ''}</span>
            <div style={{ flex: 1 }}>
              <div style={{ color: s.done ? theme.dim : theme.fg, textDecoration: s.done ? 'line-through' : 'none' }}>{s.title}</div>
              {s.note && <div style={{ color: theme.dim, fontSize: 11.5 }}>{s.note}</div>}
            </div>
          </div>
        ))}
      </div>
    </MsgRow>
  );
}

// Streaming-text caret
function StreamCaret({ theme }) {
  return <span style={{
    display: 'inline-block', width: '0.55ch', height: '1em',
    background: theme.accent, marginLeft: 2, verticalAlign: 'text-bottom',
    animation: 'kaleidBlink 1.1s steps(1) infinite',
  }} />;
}

// ─────────────────────────────────────────────────────────────────────────
// Input composer — the prominent input block
// ─────────────────────────────────────────────────────────────────────────
function InputComposer({ theme, mode = 'normal', model, lines, attached = [], placeholder, focused = true }) {
  const m = theme.modePalette[mode];
  const modeLabels = {
    normal: 'normal · accept / reject',
    plan: 'plan mode · read-only',
    auto: 'auto · accept edits',
    readonly: 'read-only',
  };
  return (
    <div style={{
      margin: '14px 22px 6px',
      flexShrink: 0,
      borderRadius: 4,
      overflow: 'hidden',
      background: theme.panel,
      border: '1px solid ' + (focused ? theme.accent : theme.border),
      boxShadow: focused ? '0 0 0 3px ' + theme.accent + '22' : 'none',
      transition: 'box-shadow .15s, border-color .15s',
    }}>
      {/* Header strip: mode pill (left) + model pill (right) */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '6px 12px',
        borderBottom: '1px solid ' + theme.rule,
        background: theme.bg,
        fontSize: 11,
      }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: m.bg, color: m.fg,
          padding: '2px 9px', borderRadius: 2,
          letterSpacing: '0.06em', textTransform: 'uppercase',
        }}>
          <span style={{ width: 5, height: 5, borderRadius: 9999, background: m.dot }} />
          {mode}
        </span>
        <span style={{ color: theme.dim }}>{modeLabels[mode]}</span>
        {attached.length > 0 && (
          <React.Fragment>
            <span style={{ color: theme.faint }}>│</span>
            <span style={{ color: theme.dim }}>attached</span>
            {attached.map((a, i) => (
              <span key={i} style={{ color: theme.fg, background: theme.faint, padding: '1px 7px', borderRadius: 2 }}>
                {a}
              </span>
            ))}
          </React.Fragment>
        )}
        <span style={{ flex: 1 }} />
        <span style={{ color: theme.dim }}>model</span>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          color: theme.fg, background: theme.faint,
          padding: '2px 9px', borderRadius: 2,
        }}>
          {model}
          <span style={{ color: theme.dim, marginLeft: 2 }}>⌄</span>
        </span>
      </div>

      {/* Multi-line input area */}
      <div style={{
        display: 'flex', alignItems: 'stretch', minHeight: 78,
        padding: '12px 14px 12px 12px', gap: 10,
      }}>
        {/* prompt sigil + line numbers */}
        <div style={{
          color: theme.dim, fontSize: 12, lineHeight: 1.55,
          textAlign: 'right', flexShrink: 0, minWidth: 22, userSelect: 'none',
        }}>
          {lines.map((_, i) => (
            <div key={i} style={{ color: i === 0 ? theme.accent : theme.faint }}>{i === 0 ? '›' : (i + 1)}</div>
          ))}
        </div>
        <div style={{ flex: 1, fontSize: 14, lineHeight: 1.55 }}>
          {lines.length === 0 || (lines.length === 1 && !lines[0]) ? (
            <span style={{ color: theme.faint }}>{placeholder}<StreamCaret theme={theme} /></span>
          ) : (
            <React.Fragment>
              {lines.map((l, i) => (
                <div key={i} style={{ color: theme.fg, minHeight: '1.55em' }}>
                  {l || <span>&nbsp;</span>}
                  {i === lines.length - 1 && focused && <StreamCaret theme={theme} />}
                </div>
              ))}
            </React.Fragment>
          )}
        </div>
      </div>

      {/* Footer hints */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '6px 14px',
        borderTop: '1px solid ' + theme.rule,
        background: theme.bg, color: theme.dim, fontSize: 11,
      }}>
        <KbdHint theme={theme} k="⌃↵" label="send" />
        <KbdHint theme={theme} k="⇧↵" label="newline" />
        <KbdHint theme={theme} k="/" label="commands" />
        <KbdHint theme={theme} k="@" label="files" />
        <KbdHint theme={theme} k="⌃M" label="model" />
        <KbdHint theme={theme} k="⌃P" label="plan" />
        <span style={{ flex: 1 }} />
        <span>{(lines.join(' ').length)} chars · {lines.length} {lines.length === 1 ? 'line' : 'lines'}</span>
      </div>
    </div>
  );
}

function KbdHint({ theme, k, label }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{
        background: theme.faint, color: theme.fg,
        padding: '1px 6px', borderRadius: 2, fontSize: 10.5,
        fontWeight: 500, minWidth: 14, textAlign: 'center',
      }}>{k}</span>
      <span>{label}</span>
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Bottom status bar
// ─────────────────────────────────────────────────────────────────────────
function StatusBar({ theme, cwd, branch, tokens, cost, model, time }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '7px 22px',
      borderTop: '1px solid ' + theme.rule,
      background: theme.panel,
      color: theme.dim, fontSize: 11, flexShrink: 0,
    }}>
      <span style={{ color: theme.fg }}>⌂</span>
      <span>{cwd}</span>
      <span style={{ color: theme.faint }}>│</span>
      <span style={{ color: theme.accent }}>⎇</span>
      <span>{branch}</span>
      <span style={{ flex: 1 }} />
      <span>tokens <span style={{ color: theme.fg }}>{tokens}</span></span>
      <span style={{ color: theme.faint }}>·</span>
      <span>cost <span style={{ color: theme.fg }}>${cost}</span></span>
      <span style={{ color: theme.faint }}>│</span>
      <span>{model}</span>
      <span style={{ color: theme.faint }}>·</span>
      <span>{time}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Welcome (only on fresh session)
// ─────────────────────────────────────────────────────────────────────────
function WelcomeBanner({ theme }) {
  return (
    <div style={{
      padding: '18px 24px',
      borderBottom: '1px solid ' + theme.rule,
      display: 'flex', alignItems: 'center', gap: 24,
      flexShrink: 0,
    }}>
      <div style={{
        position: 'relative', width: 56, height: 56, flexShrink: 0,
      }}>
        <DiamondGlyph theme={theme} size={28} />
        <span style={{ position: 'absolute', top: 8, left: 30,  opacity: .5 }}><DiamondGlyph theme={theme} size={14} /></span>
        <span style={{ position: 'absolute', top: 30, left: 0,  opacity: .35 }}><DiamondGlyph theme={theme} size={20} /></span>
        <span style={{ position: 'absolute', top: 36, left: 32, opacity: .25 }}><DiamondGlyph theme={theme} size={10} /></span>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ color: theme.fg, fontSize: 16, fontWeight: 500 }}>
          kaleid
          <span style={{ color: theme.dim, fontWeight: 400, marginLeft: 10, fontSize: 13 }}>
            v0.5.0 · kaleidoscopic terminal agent
          </span>
        </div>
        <div style={{ color: theme.dim, fontSize: 12, marginTop: 4 }}>
          multi-model · plan/auto/normal modes · MCP · subagents · resumable sessions
        </div>
      </div>
      <div style={{ display: 'flex', gap: 14, fontSize: 11, color: theme.dim, alignItems: 'center' }}>
        <KbdHint theme={theme} k="/" label="commands" />
        <KbdHint theme={theme} k="⌃R" label="resume" />
        <KbdHint theme={theme} k="⌃P" label="plan" />
        <KbdHint theme={theme} k="?" label="help" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// MAIN CHAT SCREEN — accepts `state` to drive variant
// ─────────────────────────────────────────────────────────────────────────
function ChatScreen({ theme, fontSize = 14, lineHeight = 1.55, scenario = 'streaming' }) {
  // scenario drives which conversation slice + which input/state pill we show
  const S = makeScenarios(theme);
  const v = S[scenario];

  return (
    <div style={{
      width: '100%', height: '100%',
      background: theme.bg, color: theme.fg,
      fontFamily: MONO, fontSize, lineHeight,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      <style>{`
        @keyframes kaleidBlink { 50% { opacity: 0 } }
      `}</style>
      <WindowChrome theme={theme} />
      <SessionHeader
        theme={theme}
        sessionName={v.sessionName}
        project={v.project}
        labels={v.labels}
        model={v.model}
        state={v.state}
        used={v.used}
        total={v.total}
      />

      {/* Conversation pane */}
      <div style={{
        flex: 1, padding: '4px 14px 4px',
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column', gap: 0,
      }}>
        {v.messages}
      </div>

      <InputComposer
        theme={theme}
        mode={v.mode}
        model={v.model}
        lines={v.inputLines}
        attached={v.attached}
        placeholder={v.placeholder}
        focused={v.focused}
      />
      <StatusBar theme={theme} cwd="~/work/kaleid" branch="feat/streaming-tools" tokens="48.1K / 272K" cost="0.182" model={v.model} time="14:32" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Scenario slices
// ─────────────────────────────────────────────────────────────────────────
function makeScenarios(theme) {
  return {
    streaming: {
      sessionName: 'pr-review · #1428',
      project: 'kaleid', labels: ['review', 'wip'],
      model: 'gpt-5.5', state: 'streaming', used: 48100, total: 272000,
      mode: 'normal', focused: false,
      inputLines: [''], attached: [], placeholder: 'message kaleid…',
      messages: (
        <React.Fragment>
          <UserMsg theme={theme}>
            帮我看看 <span style={{ color: theme.accent }}>#1428</span>，重点 packages/api 里的改动。还要确认 401 分支的测试覆盖。
          </UserMsg>

          <ToolCard theme={theme} name="read_file" args="packages/api/route.ts" status="ok" durationMs={140} summary="412 lines" />
          <ToolCard theme={theme} name="grep" args="TODO|FIXME packages/api" status="ok" durationMs={210} summary="12 matches" />
          <ToolCard
            theme={theme}
            name="run_tests"
            args="packages/api --filter=route"
            status="ok"
            durationMs={1620}
            summary="14 passed · 2 skipped"
            expanded
            diff={[
              ' PASS  route.test.ts                                       (1.2s)',
              '   ✓ returns 200 for valid payload',
              '   ✓ returns 400 when body is empty',
              '   ⊝ skipped: returns 401 without auth header  ← not covered',
              ' PASS  route.error.test.ts                                  (0.4s)',
            ].join('\n')}
          />

          <ThinkingBlock theme={theme} durationMs={2300} expanded={false} />

          <MsgRow theme={theme} role="kaleid" label="kaleid ›">
            我看到三个值得关注的点：
            <div style={{ marginTop: 4 }}>
              <div><span style={{ color: theme.accent }}>1.</span> <code style={{ color: theme.roles.tool.fg }}>route.ts:42</code> 错误处理吞掉了 stack trace，外层 logger 拿不到原始堆栈。</div>
              <div><span style={{ color: theme.accent }}>2.</span> 测试缺 <code style={{ color: theme.roles.tool.fg }}>401</code> 分支覆盖（上面 run_tests 的 skipped）。</div>
              <div><span style={{ color: theme.accent }}>3.</span> <code style={{ color: theme.roles.tool.fg }}>pollInterval</code><StreamCaret theme={theme} /></div>
            </div>
          </MsgRow>
        </React.Fragment>
      ),
    },

    approval: {
      sessionName: 'pr-review · #1428',
      project: 'kaleid', labels: ['review', 'wip'],
      model: 'gpt-5.5', state: 'approving', used: 51400, total: 272000,
      mode: 'normal', focused: false,
      inputLines: [''], attached: [], placeholder: 'reply, or press y/a/e/n…',
      messages: (
        <React.Fragment>
          <UserMsg theme={theme}>先改第一条吧。</UserMsg>
          <MsgRow theme={theme} role="kaleid" label="kaleid ›">
            打算把 stack trace 透传给 logger，再补一个 401 测试。
          </MsgRow>
          <ToolCard theme={theme} name="read_file" args="packages/api/route.ts" status="ok" durationMs={130} summary="ok" />
          <ApprovalCard
            theme={theme}
            command="edit packages/api/route.ts (lines 40–58)"
            risk="workspace write · 1 file"
            summary="rewrap try/catch to preserve err.stack and forward via context.logger.error"
          />
        </React.Fragment>
      ),
    },

    plan: {
      sessionName: 'db-migration-plan',
      project: 'web-app', labels: ['infra', 'planning'],
      model: 'claude-opus-4.7', state: 'thinking', used: 94000, total: 200000,
      mode: 'plan', focused: true,
      inputLines: ['让我们把现有的 users 表迁到分库分表方案上。'],
      attached: ['schema.sql', 'README.md'],
      placeholder: '',
      messages: (
        <React.Fragment>
          <SystemMsg theme={theme}>
            entered <span style={{ color: theme.state.thinking.fg }}>plan mode</span> · read-only · agent will propose, not execute
          </SystemMsg>
          <UserMsg theme={theme}>
            让我们把现有的 users 表迁到分库分表方案上。先给个 plan，落地之前我要看。
          </UserMsg>
          <ThinkingBlock theme={theme} durationMs={4800} expanded={true}
            text="schema.sql 有 ~2.1M 行，主键 user_id。\n候选切分键：user_id (mod 16) 还是 created_at 月份。\n现有外键涉及 sessions / orders 两张大表。\n下游消费者：analytics-pipeline / auth-service / web."
          />
          <PlanCard theme={theme} steps={[
            { title: '梳理 users 表的所有外键 & 下游消费者', done: true, note: '已读 schema.sql + grep 引用' },
            { title: '选定切分键 (user_id mod 16) 并产出迁移 SQL 草案', done: true },
            { title: '在 dual-write 中间层加双写开关', done: false },
            { title: '回填 + 校验脚本（按 user_id range 分批）', done: false },
            { title: 'cutover：开启读切流量 → 关闭旧表写入', done: false, note: '需 staging 演练一次' },
          ]} />
        </React.Fragment>
      ),
    },

    typing: {
      sessionName: 'untitled',
      project: 'kaleid', labels: ['inbox'],
      model: 'gpt-5.5', state: 'typing', used: 1200, total: 272000,
      mode: 'normal', focused: true,
      inputLines: [
        '/plan 帮我重构 packages/cli 的 args parser，',
        '当前用的是 minimist 但开始支持子命令了。',
        '目标：',
      ],
      attached: ['cli/index.ts'],
      placeholder: '',
      messages: (
        <React.Fragment>
          <SystemMsg theme={theme}>
            new session · model <span style={{ color: theme.fg }}>gpt-5.5</span> · cwd ~/work/kaleid · mode <span style={{ color: theme.fg }}>normal</span>
          </SystemMsg>
          {/* Slash command palette */}
          <div style={{ padding: '6px 0' }}>
            <div style={{
              background: theme.panel, border: '1px solid ' + theme.border,
              borderRadius: 4, maxWidth: 420, overflow: 'hidden',
            }}>
              <div style={{ padding: '6px 12px', borderBottom: '1px solid ' + theme.rule, color: theme.dim, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase' }}>commands · matching /plan</div>
              {[
                ['/plan',    'enter plan mode', 'switches to read-only planning'],
                ['/planfrom','plan from file', 'load a written plan and execute'],
                ['/clear',   'clear context', 'keep session, drop history'],
                ['/resume',  'resume session', 'pick from recent sessions'],
              ].map(([cmd, label, desc], i) => (
                <div key={i} style={{
                  padding: '6px 12px',
                  background: i === 0 ? theme.selectionBg : 'transparent',
                  display: 'flex', alignItems: 'baseline', gap: 12, fontSize: 12,
                }}>
                  <span style={{ color: i === 0 ? theme.accent : theme.fg, width: 90, fontWeight: i === 0 ? 500 : 400 }}>{cmd}</span>
                  <span style={{ color: theme.fg }}>{label}</span>
                  <span style={{ color: theme.dim, marginLeft: 'auto' }}>{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </React.Fragment>
      ),
    },
  };
}

// ═════════════════════════════════════════════════════════════════════════
// RESUME SCREEN — model + project + label filters + preview
// ═════════════════════════════════════════════════════════════════════════
const RESUME_SESSIONS = [
  { id: 'a', name: 'pr-review · #1428',         model: 'gpt-5.5',          project: 'kaleid',    labels: ['review','wip'],     age: '2m ago',    ctx: '48.1K', cost: '$0.18', preview: '我看到三个值得关注的点：route.ts:42 错误处理吞掉了 stack…', msgs: 24, branch: 'feat/streaming-tools' },
  { id: 'b', name: 'onboarding-flow',           model: 'claude-opus-4.7',  project: 'web-app',   labels: ['design'],           age: '1h ago',    ctx: '94.2K', cost: '$1.21', preview: 'I pulled the design tokens from your figma-export and started…', msgs: 67, branch: 'design/onboarding' },
  { id: 'c', name: 'db-migration-plan',         model: 'claude-opus-4.7',  project: 'web-app',   labels: ['infra','planning'], age: 'yesterday', ctx: '94.0K', cost: '$0.92', preview: 'plan written to .kaleid/plans/users-shard.md — 5 steps, 2 done…', msgs: 31, branch: 'infra/shard-users' },
  { id: 'd', name: 'cite-survey-paper',         model: 'deepseek-v4-pro',  project: 'research',  labels: ['docs'],             age: '2d ago',    ctx: '156K',  cost: '$0.04', preview: 'collected 42 citations across arxiv + acl-anthology — clusters…', msgs: 18, branch: '—' },
  { id: 'e', name: 'refactor-auth-middleware',  model: 'claude-sonnet-4',  project: 'kaleid',    labels: ['refactor','wip'],   age: '3d ago',    ctx: '31.0K', cost: '$0.31', preview: 'pulled out the JWT verifier into its own module; tests pass…', msgs: 12, branch: 'refactor/auth' },
  { id: 'f', name: 'shopping-list',             model: 'gpt-5.5',          project: 'personal',  labels: ['inbox'],            age: '5d ago',    ctx: '2.1K',  cost: '$0.00', preview: 'eggs, milk, ginger, 黄油, oats — for the week.',                  msgs: 4,  branch: '—' },
  { id: 'g', name: 'spec-draft-v3',             model: 'gpt-5.5',          project: 'kaleid',    labels: ['planning'],         age: '6d ago',    ctx: '21.0K', cost: '$0.15', preview: 'agent api spec, v3: streaming envelope + tool result schema…',   msgs: 22, branch: 'spec/v3' },
  { id: 'h', name: 'cli-bug-hunt',              model: 'claude-opus-4.7',  project: 'kaleid',    labels: ['wip'],              age: '1w ago',    ctx: '8.4K',  cost: '$0.08', preview: 'reproduced the resume-history off-by-one — root cause in…',     msgs: 9,  branch: 'fix/resume-idx' },
];

function ResumeScreen({ theme, fontSize = 14, lineHeight = 1.55 }) {
  return (
    <div style={{
      width: '100%', height: '100%',
      background: theme.bg, color: theme.fg,
      fontFamily: MONO, fontSize, lineHeight,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      <style>{`
        @keyframes kaleidBlink { 50% { opacity: 0 } }
      `}</style>
      <WindowChrome theme={theme} />

      {/* Header banner — resume mode */}
      <div style={{
        padding: '14px 24px 12px',
        borderBottom: '1px solid ' + theme.rule,
        background: theme.panel,
        display: 'flex', alignItems: 'baseline', gap: 16, flexShrink: 0,
      }}>
        <DiamondGlyph theme={theme} size={18} />
        <span style={{ color: theme.fg, fontWeight: 500 }}>resume</span>
        <span style={{ color: theme.dim, fontSize: 12 }}>continue a previous session — 8 of 24 shown, filtered</span>
        <span style={{ flex: 1 }} />
        <span style={{ color: theme.dim, fontSize: 11 }}>
          <KbdHint theme={theme} k="↑↓" label="navigate" />
          <span style={{ margin: '0 10px' }} />
          <KbdHint theme={theme} k="↵" label="resume" />
          <span style={{ margin: '0 10px' }} />
          <KbdHint theme={theme} k="n" label="new" />
          <span style={{ margin: '0 10px' }} />
          <KbdHint theme={theme} k="d" label="delete" />
          <span style={{ margin: '0 10px' }} />
          <KbdHint theme={theme} k="esc" label="cancel" />
        </span>
      </div>

      {/* FILTER BAR — search + project + model + label + date */}
      <FilterBar theme={theme} />

      {/* Two-column body: list + preview */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 360px', minHeight: 0 }}>
        <SessionList theme={theme} sessions={RESUME_SESSIONS} selectedId="a" />
        <SessionPreview theme={theme} session={RESUME_SESSIONS[0]} />
      </div>

      <StatusBar theme={theme} cwd="~/work/kaleid" branch="—" tokens="0 / 272K" cost="0.000" model="gpt-5.5" time="14:31" />
    </div>
  );
}

function FilterBar({ theme }) {
  return (
    <div style={{
      padding: '10px 24px 12px',
      borderBottom: '1px solid ' + theme.rule,
      display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0,
    }}>
      {/* Search */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: theme.panel,
        border: '1px solid ' + theme.border,
        borderRadius: 3, padding: '5px 12px',
      }}>
        <span style={{ color: theme.dim }}>⌕</span>
        <span style={{ color: theme.fg, flex: 1 }}>
          stack trace<StreamCaret theme={theme} />
        </span>
        <span style={{ color: theme.dim, fontSize: 11 }}>fuzzy across messages + titles</span>
      </div>

      {/* Filter dropdowns + chips */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
        <FilterDropdown theme={theme} label="project" value="kaleid" active />
        <FilterDropdown theme={theme} label="model" value="gpt-5.5" active />
        <FilterDropdown theme={theme} label="date" value="< 1 week" />

        <span style={{ color: theme.faint }}>│</span>
        <span style={{ color: theme.dim, fontSize: 11 }}>labels</span>
        <FilterChipTag theme={theme} name="review"   active />
        <FilterChipTag theme={theme} name="wip"      active />
        <FilterChipTag theme={theme} name="design" />
        <FilterChipTag theme={theme} name="infra" />
        <FilterChipTag theme={theme} name="planning" />
        <FilterChipTag theme={theme} name="refactor" />
        <FilterChipTag theme={theme} name="docs" />
        <FilterChipTag theme={theme} name="inbox" />

        <span style={{ flex: 1 }} />
        <span style={{ color: theme.dim, fontSize: 11 }}>
          <span style={{ color: theme.accent }}>3</span> active · <span style={{ color: theme.fg, textDecoration: 'underline' }}>clear</span>
        </span>
      </div>
    </div>
  );
}

function FilterDropdown({ theme, label, value, active }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      padding: '3px 10px',
      border: '1px solid ' + (active ? theme.accent : theme.border),
      background: active ? theme.accent + '14' : 'transparent',
      borderRadius: 3, fontSize: 12,
    }}>
      <span style={{ color: theme.dim, fontSize: 11 }}>{label}</span>
      <span style={{ color: active ? theme.accent : theme.fg, fontWeight: active ? 500 : 400 }}>{value}</span>
      <span style={{ color: theme.dim }}>⌄</span>
    </span>
  );
}

function FilterChipTag({ theme, name, active }) {
  const c = theme.labels[name] || theme.labels.inbox;
  return (
    <span style={{
      background: active ? c.bg : 'transparent',
      color: active ? c.fg : theme.dim,
      border: '1px solid ' + (active ? c.fg + '00' : theme.border),
      padding: '1px 8px', borderRadius: 3,
      fontSize: 11, letterSpacing: '0.02em',
      textDecoration: active ? 'none' : 'none',
      opacity: active ? 1 : 0.7,
    }}>#{name}</span>
  );
}

function SessionList({ theme, sessions, selectedId }) {
  return (
    <div style={{ overflow: 'hidden', padding: '6px 0', borderRight: '1px solid ' + theme.rule }}>
      {/* Column headers */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '20px minmax(0, 1.4fr) 1fr auto auto',
        gap: 18, padding: '6px 24px 8px', color: theme.dim, fontSize: 10.5,
        letterSpacing: '0.12em', textTransform: 'uppercase',
        borderBottom: '1px dashed ' + theme.faint,
      }}>
        <span> </span>
        <span>session</span>
        <span>model · labels</span>
        <span style={{ textAlign: 'right' }}>ctx</span>
        <span style={{ textAlign: 'right' }}>last</span>
      </div>

      {sessions.map((s) => {
        const sel = s.id === selectedId;
        return (
          <div key={s.id} style={{
            display: 'grid',
            gridTemplateColumns: '20px minmax(0, 1.4fr) 1fr auto auto',
            gap: 18, padding: '7px 24px',
            alignItems: 'center',
            background: sel ? theme.selectionBg : 'transparent',
            borderLeft: '3px solid ' + (sel ? theme.accent : 'transparent'),
            paddingLeft: 21,
          }}>
            <span style={{ color: sel ? theme.accent : theme.faint }}>{sel ? '›' : ' '}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <span style={{ color: sel ? theme.selectionFg : theme.fg, fontWeight: sel ? 500 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</span>
              <ProjectChip theme={theme} name={s.project} />
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <span style={{ color: theme.dim, fontSize: 11.5 }}>{s.model}</span>
              <span style={{ color: theme.faint }}>·</span>
              <span style={{ display: 'flex', gap: 5, overflow: 'hidden' }}>
                {s.labels.map(l => <LabelChip key={l} theme={theme} name={l} />)}
              </span>
            </span>
            <span style={{ color: theme.dim, fontSize: 11.5, textAlign: 'right', whiteSpace: 'nowrap' }}>{s.ctx}</span>
            <span style={{ color: theme.dim, fontSize: 11.5, textAlign: 'right', whiteSpace: 'nowrap', minWidth: 88 }}>{s.age}</span>
          </div>
        );
      })}
    </div>
  );
}

function SessionPreview({ theme, session }) {
  return (
    <div style={{ padding: '14px 18px', overflow: 'hidden', background: theme.panel }}>
      <div style={{ color: theme.dim, fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>preview</div>
      <div style={{ color: theme.fg, fontSize: 15, fontWeight: 500, marginBottom: 4 }}>{session.name}</div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <ProjectChip theme={theme} name={session.project} />
        {session.labels.map(l => <LabelChip key={l} theme={theme} name={l} />)}
      </div>

      <div style={{
        background: theme.bg, border: '1px solid ' + theme.rule,
        borderRadius: 3, padding: '10px 12px', marginBottom: 14,
        color: theme.fg, fontSize: 12, lineHeight: 1.5,
      }}>
        <div style={{ color: theme.dim, fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>last reply · kaleid</div>
        <div>{session.preview}</div>
      </div>

      {/* Meta grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', fontSize: 11.5 }}>
        <Meta theme={theme} k="model"     v={session.model} />
        <Meta theme={theme} k="messages"  v={session.msgs} />
        <Meta theme={theme} k="context"   v={session.ctx} />
        <Meta theme={theme} k="cost"      v={session.cost} />
        <Meta theme={theme} k="branch"    v={session.branch} mono />
        <Meta theme={theme} k="last seen" v={session.age} />
      </div>

      <div style={{
        marginTop: 16,
        display: 'flex', gap: 10, alignItems: 'stretch',
      }}>
        <PreviewBtn theme={theme} kbd="↵" label="resume" primary />
        <PreviewBtn theme={theme} kbd="space" label="fork" />
        <PreviewBtn theme={theme} kbd="d" label="delete" danger />
      </div>
    </div>
  );
}

function Meta({ theme, k, v, mono }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed ' + theme.faint, padding: '3px 0' }}>
      <span style={{ color: theme.dim }}>{k}</span>
      <span style={{ color: theme.fg, fontFamily: mono ? MONO : 'inherit' }}>{v}</span>
    </div>
  );
}

function PreviewBtn({ theme, kbd, label, primary, danger }) {
  const c = danger ? theme.state.err.fg : primary ? theme.accent : theme.fg;
  return (
    <div style={{
      flex: 1, padding: '7px 10px',
      border: '1px solid ' + (primary ? c : theme.border),
      background: primary ? c + '12' : 'transparent',
      borderRadius: 3, display: 'flex', alignItems: 'center', gap: 8,
      cursor: 'default',
    }}>
      <span style={{
        background: c + '22', color: c,
        padding: '1px 7px', borderRadius: 2,
        fontSize: 11, fontWeight: 600,
      }}>{kbd}</span>
      <span style={{ color: c, fontSize: 12 }}>{label}</span>
    </div>
  );
}

window.ChatScreen = ChatScreen;
window.ResumeScreen = ResumeScreen;
