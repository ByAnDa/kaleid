// kaleid TUI — screen primitives & full screens
// Renders the OS window chrome (tab bar) + the kaleid TUI body.
// Two screens: ChatScreen and ResumeScreen. Both take { theme, fontSize, lineHeight, showBox }.

const { useMemo } = React;

// ────────────────────────────────────────────────────────────────────────────
// Window chrome (the OS terminal wrapping the TUI)
// ────────────────────────────────────────────────────────────────────────────

function WindowChrome({ theme, title = 'administrator@BYANDA-Work' }) {
  return (
    <div style={{
      background: theme.chrome,
      color: theme.chromeFg,
      height: 36,
      display: 'flex',
      alignItems: 'stretch',
      flexShrink: 0,
      fontSize: 12,
      fontFamily: 'inherit',
      borderBottom: '1px solid ' + theme.border,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px', gap: 8, background: theme.panel, borderRight: '1px solid ' + theme.border }}>
        <span style={{ color: theme.accent, fontSize: 12 }}>▶_</span>
        <span style={{ color: theme.fg }}>{title}</span>
        <span style={{ color: theme.dim, marginLeft: 4, cursor: 'default' }}>✕</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', padding: '0 10px', color: theme.dim }}>＋</div>
      <div style={{ display: 'flex', alignItems: 'center', padding: '0 6px', color: theme.dim }}>⌄</div>
      <div style={{ flex: 1 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '0 18px', color: theme.dim }}>
        <span>—</span>
        <span>▢</span>
        <span>✕</span>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Header bar (kaleid · model · verbosity)
// ────────────────────────────────────────────────────────────────────────────

function HeaderBar({ theme, model = 'gpt-5.5 [openai-codex]', verbosity = 'medium' }) {
  return (
    <div style={{
      borderBottom: '1px solid ' + theme.rule,
      padding: '10px 18px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      background: theme.bg,
      borderRadius: 4,
      margin: '8px 12px 0',
      border: '1px solid ' + theme.border,
      flexShrink: 0,
    }}>
      <span style={{ color: theme.accent, fontWeight: 600 }}>kaleid</span>
      <span style={{ color: theme.dim }}>
        <span style={{ color: theme.fg }}>{model}</span>
        <span style={{ margin: '0 8px' }}>·</span>
        <span>{verbosity}</span>
      </span>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Geometric logo (kaleidoscope diamond), recolored per theme
// ────────────────────────────────────────────────────────────────────────────

function GeometricLogo({ theme, size = 'md' }) {
  // 5-line diamond pattern. Solid (◆) uses accent, light (◇) uses dim.
  const lines = [
    '   ◆   ',
    '  ◆◇◆  ',
    ' ◆◇◆◇◆ ',
    '  ◆◇◆  ',
    '   ◆   ',
  ];
  const fontSize = size === 'sm' ? 14 : size === 'lg' ? 22 : 18;
  return (
    <pre style={{
      margin: 0,
      fontFamily: 'inherit',
      fontSize,
      lineHeight: 1.1,
      letterSpacing: '0.05em',
      color: theme.accent,
      whiteSpace: 'pre',
    }}>
      {lines.map((l, i) => (
        <div key={i}>
          {l.split('').map((c, j) => (
            <span key={j} style={{ color: c === '◇' ? theme.dim : theme.accent }}>{c}</span>
          ))}
        </div>
      ))}
    </pre>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Welcome banner (logo + version/model/tips)
// ────────────────────────────────────────────────────────────────────────────

function WelcomeBanner({ theme, model = 'gpt-5.5', agent = 'openai-codex', version = 'v0.4.2', showBox = false, compact = false }) {
  const content = (
    <div style={{
      display: 'flex',
      gap: 28,
      alignItems: 'center',
      padding: compact ? '14px 18px' : '22px 28px',
    }}>
      <GeometricLogo theme={theme} size={compact ? 'sm' : 'md'} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div>
          <span style={{ color: theme.accent, fontWeight: 600 }}>kaleid</span>
          <span style={{ color: theme.dim, marginLeft: 8 }}>{version}</span>
          <span style={{ color: theme.faint, margin: '0 8px' }}>·</span>
          <span style={{ color: theme.fg }}>{model}</span>
          <span style={{ color: theme.dim, marginLeft: 8 }}>[{agent}]</span>
        </div>
        <div style={{ color: theme.dim, fontSize: '0.92em' }}>
          a kaleidoscopic terminal agent · multi-model · project & label scoped
        </div>
        <div style={{ color: theme.dim, marginTop: 6, fontSize: '0.92em' }}>
          <Kbd theme={theme}>/help</Kbd>
          <span style={{ margin: '0 8px' }}>·</span>
          <Kbd theme={theme}>/resume</Kbd>
          <span style={{ margin: '0 8px' }}>·</span>
          <Kbd theme={theme}>/label</Kbd>
          <span style={{ margin: '0 8px' }}>·</span>
          <Kbd theme={theme}>⌃C</Kbd> interrupt
          <span style={{ margin: '0 8px' }}>·</span>
          <Kbd theme={theme}>⌃D</Kbd> exit
        </div>
      </div>
    </div>
  );

  if (showBox) {
    return <BoxFrame theme={theme} title="welcome" margin="10px 12px 0">{content}</BoxFrame>;
  }
  return (
    <div style={{
      margin: '10px 12px 0',
      borderTop: '1px solid ' + theme.rule,
      borderBottom: '1px solid ' + theme.rule,
    }}>{content}</div>
  );
}

function Kbd({ theme, children }) {
  return (
    <span style={{
      color: theme.fg,
      background: theme.faint,
      padding: '1px 6px',
      borderRadius: 3,
      fontSize: '0.9em',
    }}>{children}</span>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// ASCII box frame
// ────────────────────────────────────────────────────────────────────────────

function BoxFrame({ theme, title, margin = 0, children }) {
  const c = theme.border;
  return (
    <div style={{ margin, position: 'relative', border: '1px solid ' + c, borderRadius: 2 }}>
      {title && (
        <div style={{
          position: 'absolute',
          top: -9,
          left: 16,
          background: theme.bg,
          padding: '0 8px',
          color: theme.dim,
          fontSize: '0.88em',
        }}>┤ {title} ├</div>
      )}
      {children}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Label / project badges (GitHub-tag style)
// ────────────────────────────────────────────────────────────────────────────

function Label({ theme, name, kind = 'label' }) {
  const palette = kind === 'project' ? theme.projects : theme.labels;
  const c = palette[name] || theme.labels.inbox;
  const prefix = kind === 'project' ? '' : '#';
  return (
    <span style={{
      background: c.bg,
      color: c.fg,
      padding: '1px 7px',
      borderRadius: 3,
      fontSize: '0.88em',
      letterSpacing: '0.02em',
    }}>{prefix}{name}</span>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Chat row (role gutter + role label + content)
// ────────────────────────────────────────────────────────────────────────────

function Row({ theme, role, label, children, continuation = false, indent = 0 }) {
  const r = theme.roles[role];
  const isBlock = theme.gutterStyle === 'block';
  const gutterW = isBlock ? 8 : 3;
  return (
    <div style={{ display: 'flex', alignItems: 'stretch', minHeight: '1.5em' }}>
      <div style={{
        width: gutterW,
        background: isBlock ? r.gutter : 'transparent',
        borderLeft: isBlock ? 'none' : '2px solid ' + r.gutter,
        marginRight: isBlock ? 10 : 12,
        flexShrink: 0,
      }} />
      <div style={{
        width: 64,
        flexShrink: 0,
        color: continuation ? 'transparent' : r.fg,
        fontWeight: continuation ? 400 : 500,
        userSelect: continuation ? 'none' : 'auto',
      }}>{continuation ? '' : (label || role)}</div>
      <div style={{
        flex: 1,
        color: theme.fg,
        paddingLeft: indent * 2 + 'ch',
      }}>{children}</div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Tool call card (default folded; expanded shows output)
// ────────────────────────────────────────────────────────────────────────────

function ToolCall({ theme, name, args, status = 'ok', result, expanded = false, output }) {
  const r = theme.roles.tool;
  const statusGlyph = status === 'ok' ? '✓' : status === 'err' ? '✗' : '⟳';
  const statusColor = status === 'ok' ? r.fg : status === 'err' ? '#f87171' : theme.dim;
  return (
    <div style={{ color: theme.fg }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 0, whiteSpace: 'nowrap' }}>
        <span style={{ color: r.fg, width: '1.5ch', display: 'inline-block' }}>{expanded ? '▾' : '▸'}</span>
        <span style={{ color: r.fg, fontWeight: 500 }}>{name}</span>
        <span style={{ color: theme.dim }}>(</span>
        <span style={{ color: theme.fg, overflow: 'hidden', textOverflow: 'ellipsis' }}>{args}</span>
        <span style={{ color: theme.dim }}>)</span>
        <span style={{ flex: 1 }} />
        <span style={{ color: statusColor }}>{statusGlyph}</span>
        {result && <span style={{ color: theme.dim, marginLeft: 8 }}>{result}</span>}
      </div>
      {expanded && output && (
        <div style={{
          marginTop: 4,
          marginLeft: '1.5ch',
          paddingLeft: 12,
          borderLeft: '1px dashed ' + theme.faint,
          color: theme.dim,
          whiteSpace: 'pre',
          fontSize: '0.95em',
        }}>{output}</div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Multiline input box
// ────────────────────────────────────────────────────────────────────────────

function InputBox({ theme, lines, showBox = false }) {
  const rule = '─'.repeat(160);
  return (
    <div style={{
      margin: '6px 12px 0',
      flexShrink: 0,
    }}>
      <div style={{
        color: theme.faint,
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        lineHeight: 1,
        height: '1em',
      }}>{showBox ? '╭' + '─'.repeat(220) + '╮' : rule}</div>
      <div style={{
        display: 'flex',
        gap: 10,
        padding: '8px 4px 6px',
        borderLeft: showBox ? '1px solid ' + theme.border : 'none',
        borderRight: showBox ? '1px solid ' + theme.border : 'none',
      }}>
        <span style={{ color: theme.accent, flexShrink: 0 }}>›</span>
        <div style={{ flex: 1, color: theme.fg }}>
          {lines.map((l, i) => (
            <div key={i} style={{ minHeight: '1.5em' }}>
              {i === 0 ? l : <span style={{ color: theme.dim }}>{l}</span>}
              {i === lines.length - 1 && <span style={{ background: theme.accent, marginLeft: 1, color: 'transparent', display: 'inline-block', width: '0.55ch', height: '1em', verticalAlign: 'middle' }}>·</span>}
            </div>
          ))}
        </div>
      </div>
      <div style={{
        color: theme.faint,
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        lineHeight: 1,
        height: '1em',
      }}>{showBox ? '╰' + '─'.repeat(220) + '╯' : rule}</div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Status bar (rich): tokens + keys + project/label + model + time
// ────────────────────────────────────────────────────────────────────────────

function StatusBar({ theme, tokens = '12.3K / 272K', pct = '4.5%', keys = [], session, project, labels = [], model = 'gpt-5.5', time = '14:32' }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '8px 18px 10px',
      gap: 18,
      flexShrink: 0,
      color: theme.dim,
      fontSize: '0.92em',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ color: theme.accent }}>●</span>
        <span style={{ color: theme.fg }}>ctx {tokens}</span>
        <span style={{ color: theme.dim }}>·</span>
        <span style={{ color: theme.fg }}>{pct}</span>
        <span style={{ color: theme.faint, marginLeft: 14 }}>│</span>
        {keys.map((k, i) => (
          <React.Fragment key={i}>
            <Kbd theme={theme}>{k.key}</Kbd>
            <span style={{ color: theme.dim, marginRight: 2 }}>{k.label}</span>
          </React.Fragment>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {session && <span style={{ color: theme.fg }}>{session}</span>}
        {project && <Label theme={theme} name={project} kind="project" />}
        {labels.map((l) => <Label key={l} theme={theme} name={l} />)}
        <span style={{ color: theme.faint }}>│</span>
        <span>{model}</span>
        <span style={{ color: theme.faint }}>·</span>
        <span>{time}</span>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// CHAT SCREEN
// ────────────────────────────────────────────────────────────────────────────

function ChatScreen({ theme, fontSize = 14, lineHeight = 1.55, showBox }) {
  const useBox = showBox ?? (theme.boxDrawing === 'full');
  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: theme.bg,
      color: theme.fg,
      fontFamily: '"JetBrains Mono", "IBM Plex Mono", "SF Mono", ui-monospace, monospace',
      fontSize,
      lineHeight,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <WindowChrome theme={theme} />
      <HeaderBar theme={theme} />
      <WelcomeBanner theme={theme} showBox={useBox} />

      {/* Chat scroll area */}
      <div style={{ flex: 1, padding: '14px 16px 8px', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Row theme={theme} role="system" label="system">
          <span style={{ color: theme.dim }}>resumed session</span>
          <span style={{ color: theme.faint, margin: '0 8px' }}>›</span>
          <span style={{ color: theme.fg }}>pr-review</span>
          <span style={{ color: theme.faint, margin: '0 8px' }}>·</span>
          <Label theme={theme} name="kaleid" kind="project" />
          <span style={{ marginLeft: 6 }}><Label theme={theme} name="review" /></span>
          <span style={{ marginLeft: 6 }}><Label theme={theme} name="wip" /></span>
        </Row>

        <Row theme={theme} role="you" label="you">
          帮我看看 <span style={{ color: theme.accent }}>#1428</span> 这个 PR，重点是 packages/api 里的改动。
        </Row>

        <Row theme={theme} role="kaleid" label="kaleid">
          先把 diff 读一下，分两步：(1) 静态扫一遍变更；(2) 检查测试覆盖。
        </Row>

        <Row theme={theme} role="tool" label="tool">
          <ToolCall theme={theme} name="read_file" args="packages/api/route.ts" status="ok" result="412 lines" />
        </Row>
        <Row theme={theme} role="tool" label="" continuation>
          <ToolCall theme={theme} name="grep" args={'"TODO|FIXME" packages/api'} status="ok" result="12 matches" />
        </Row>
        <Row theme={theme} role="tool" label="" continuation>
          <ToolCall
            theme={theme}
            name="run_tests"
            args="packages/api --filter=route"
            status="ok"
            result="14 passed · 2 skipped · 0 failed"
            expanded
            output={[
              '  PASS  route.test.ts                                       (1.2s)',
              '   ✓ returns 200 for valid payload',
              '   ✓ returns 400 when body is empty',
              '   ⊝ skipped: returns 401 without auth header  ← not covered',
              '  PASS  route.error.test.ts                                  (0.4s)',
            ].join('\n')}
          />
        </Row>

        <Row theme={theme} role="kaleid" label="kaleid">
          我看到三个值得关注的点：
        </Row>
        <Row theme={theme} role="kaleid" label="" continuation>
          <div><span style={{ color: theme.accent }}>1.</span> <code style={{ color: theme.roles.tool.fg }}>route.ts:42</code> 错误处理吞掉了 stack trace，外层 logger 拿不到。</div>
          <div><span style={{ color: theme.accent }}>2.</span> 测试缺 <code style={{ color: theme.roles.tool.fg }}>401</code> 分支覆盖（上面 run_tests 的 skipped）。</div>
          <div><span style={{ color: theme.accent }}>3.</span> <code style={{ color: theme.roles.tool.fg }}>pollInterval</code> 写死 500ms，建议读 env。</div>
          <div style={{ marginTop: 4, color: theme.dim }}>要我直接动手改第一条吗？</div>
        </Row>

        <Row theme={theme} role="you" label="you">
          先改第一条，顺便加上 401 测试。
        </Row>
      </div>

      <InputBox theme={theme} showBox={useBox} lines={[
        '把 stack trace 透传给上游 logger',
        '另外把 1xx / 4xx / 5xx 分类计数加上',
      ]} />

      <StatusBar
        theme={theme}
        tokens="12.3K / 272K"
        pct="4.5%"
        keys={[
          { key: '⌃R', label: 'resume' },
          { key: '⌃L', label: 'label' },
          { key: '⌃P', label: 'project' },
          { key: '⇧↵', label: 'newline' },
        ]}
        session="pr-review"
        project="kaleid"
        labels={['review', 'wip']}
        model="gpt-5.5"
        time="14:32"
      />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// RESUME SCREEN
// ────────────────────────────────────────────────────────────────────────────

const RESUME_SESSIONS = [
  { id: 1, name: 'pr-review',         model: 'gpt-5.5',          project: 'kaleid',    labels: ['review','wip'],   age: '2 min ago',  ctx: '12.3K' },
  { id: 2, name: 'onboarding-flow',   model: 'claude-opus-4.5',  project: 'web-app',   labels: ['design'],         age: '1 hour ago', ctx: '48.1K' },
  { id: 3, name: 'db-migration-plan', model: 'gpt-5.5',          project: 'web-app',   labels: ['infra','planning'],age:'yesterday',  ctx: '94.0K' },
  { id: 4, name: 'cite-survey',       model: 'deepseek-v4-pro',  project: 'research',  labels: ['docs'],           age: '2d ago',     ctx: '156K'  },
  { id: 5, name: 'refactor-auth',     model: 'claude-sonnet-4',  project: 'kaleid',    labels: ['refactor','wip'], age: '3d ago',     ctx: '31.0K' },
  { id: 6, name: 'shopping-list',     model: 'gpt-5.5',          project: 'personal',  labels: ['inbox'],          age: '5d ago',     ctx: '2.1K'  },
  { id: 7, name: 'spec-draft-v3',     model: 'gpt-5.5',          project: 'kaleid',    labels: ['planning'],       age: '6d ago',     ctx: '21.0K' },
  { id: 8, name: 'cli-bug-hunt',      model: 'claude-opus-4.5',  project: 'kaleid',    labels: ['wip'],            age: '1w ago',     ctx: '8.4K'  },
];

function ResumeScreen({ theme, fontSize = 14, lineHeight = 1.6, showBox, selected = 0 }) {
  const useBox = showBox ?? (theme.boxDrawing === 'full');
  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: theme.bg,
      color: theme.fg,
      fontFamily: '"JetBrains Mono", "IBM Plex Mono", "SF Mono", ui-monospace, monospace',
      fontSize,
      lineHeight,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <WindowChrome theme={theme} />
      <HeaderBar theme={theme} />
      <WelcomeBanner theme={theme} showBox={useBox} compact />

      {/* Filter bar */}
      <div style={{
        margin: '14px 16px 4px',
        padding: '8px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 18,
        flexShrink: 0,
        borderTop: '1px solid ' + theme.rule,
        borderBottom: '1px solid ' + theme.rule,
      }}>
        <span style={{ color: theme.dim }}>resume session</span>
        <span style={{ color: theme.faint }}>│</span>
        <span style={{ color: theme.dim }}>project</span>
        <FilterChip theme={theme}>all</FilterChip>
        <span style={{ color: theme.dim }}>·</span>
        <FilterChip theme={theme} active>kaleid</FilterChip>
        <FilterChip theme={theme}>web-app</FilterChip>
        <FilterChip theme={theme}>research</FilterChip>
        <FilterChip theme={theme}>personal</FilterChip>
        <span style={{ color: theme.faint, marginLeft: 8 }}>│</span>
        <span style={{ color: theme.dim }}>label</span>
        <FilterChip theme={theme} active>#all</FilterChip>
        <FilterChip theme={theme}>#review</FilterChip>
        <FilterChip theme={theme}>#wip</FilterChip>
        <FilterChip theme={theme}>#design</FilterChip>
        <FilterChip theme={theme}>+3</FilterChip>
        <span style={{ flex: 1 }} />
        <span style={{ color: theme.dim }}><Kbd theme={theme}>/</Kbd> search</span>
      </div>

      {/* Session list */}
      <div style={{ flex: 1, padding: '4px 16px', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto auto auto', gap: '4px 22px', padding: '6px 0 8px', color: theme.dim, fontSize: '0.9em', borderBottom: '1px dashed ' + theme.faint }}>
          <span> </span>
          <span>session</span>
          <span>model</span>
          <span>labels</span>
          <span style={{ textAlign: 'right' }}>last active</span>
        </div>
        {RESUME_SESSIONS.map((s, i) => {
          const isSel = i === selected;
          return (
            <div key={s.id} style={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr auto auto auto',
              gap: '4px 22px',
              padding: '6px 8px 6px 0',
              alignItems: 'center',
              background: isSel ? theme.selectionBg : 'transparent',
              borderLeft: '3px solid ' + (isSel ? theme.accent : 'transparent'),
              paddingLeft: 10,
              marginLeft: -10,
            }}>
              <span style={{ color: isSel ? theme.accent : theme.faint, width: '2ch' }}>{isSel ? '›' : ' '}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                <span style={{ color: isSel ? theme.selectionFg : theme.fg, fontWeight: isSel ? 500 : 400 }}>{s.name}</span>
                <Label theme={theme} name={s.project} kind="project" />
              </span>
              <span style={{ color: theme.dim }}>{s.model}</span>
              <span style={{ display: 'flex', gap: 6 }}>
                {s.labels.map(l => <Label key={l} theme={theme} name={l} />)}
              </span>
              <span style={{ color: theme.dim, textAlign: 'right', whiteSpace: 'nowrap' }}>
                <span style={{ color: theme.faint }}>{s.ctx}</span>
                <span style={{ margin: '0 8px', color: theme.faint }}>·</span>
                {s.age}
              </span>
            </div>
          );
        })}
      </div>

      <InputBox theme={theme} showBox={useBox} lines={['']} />

      <StatusBar
        theme={theme}
        tokens="0 / 272K"
        pct="0.0%"
        keys={[
          { key: '↑↓', label: 'navigate' },
          { key: '↵', label: 'resume' },
          { key: 'n', label: 'new' },
          { key: 'd', label: 'delete' },
          { key: 'esc', label: 'cancel' },
        ]}
        session="untitled"
        model="gpt-5.5"
        time="14:31"
      />
    </div>
  );
}

function FilterChip({ theme, active, children }) {
  return (
    <span style={{
      color: active ? theme.accent : theme.fg,
      borderBottom: active ? '1px solid ' + theme.accent : '1px solid transparent',
      paddingBottom: 1,
    }}>{children}</span>
  );
}

window.ChatScreen = ChatScreen;
window.ResumeScreen = ResumeScreen;
