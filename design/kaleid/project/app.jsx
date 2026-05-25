// kaleid TUI v2 — design canvas
// Layout:
//   Daylight section: Resume, Streaming, Plan, Approval, Typing
//   Spectrum section: Resume, Streaming, Plan, Approval, Typing
//
// Each ChatScreen scenario corresponds to a distinct TUI state.

const KALEID_TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "fontSize": 13,
  "lineHeight": 1.55,
  "showResume": true,
  "showStreaming": true,
  "showPlan": true,
  "showApproval": true,
  "showTyping": true
}/*EDITMODE-END*/;

const W = 1280;
const H = 820;

const SCENARIOS = [
  { key: 'resume',    label: 'Resume',        comp: 'ResumeScreen', tweak: 'showResume' },
  { key: 'streaming', label: 'Streaming reply · tool calls', scenario: 'streaming', tweak: 'showStreaming' },
  { key: 'plan',      label: 'Plan mode',     scenario: 'plan',     tweak: 'showPlan' },
  { key: 'approval',  label: 'Awaiting approval', scenario: 'approval', tweak: 'showApproval' },
  { key: 'typing',    label: 'Typing · slash palette', scenario: 'typing', tweak: 'showTyping' },
];

function App() {
  const [tweaks, setTweak] = useTweaks(KALEID_TWEAK_DEFAULTS);

  const lightTheme = React.useMemo(() => window.themeFromTokens('light'), []);
  const darkTheme  = React.useMemo(() => window.themeFromTokens('dark'),  []);

  const renderArtboard = (theme, sc) => {
    if (sc.comp === 'ResumeScreen') {
      return <ResumeScreen theme={theme} fontSize={tweaks.fontSize} lineHeight={tweaks.lineHeight} />;
    }
    return <ChatScreen theme={theme} fontSize={tweaks.fontSize} lineHeight={tweaks.lineHeight} scenario={sc.scenario} />;
  };

  const variants = [
    { key: 'daylight', theme: lightTheme, title: 'Daylight · light mode', subtitle: 'warm parchment, ink-on-paper roles, burnt-orange accent' },
    { key: 'spectrum', theme: darkTheme,  title: 'Spectrum · dark mode', subtitle: 'deep ink, multi-hue role gutters, hot-pink accent' },
  ];

  return (
    <React.Fragment>
      <DesignCanvas>
        {variants.map(({ key, theme, title, subtitle }) => (
          <DCSection id={key} key={key} title={title} subtitle={subtitle}>
            {SCENARIOS.filter(sc => tweaks[sc.tweak]).map(sc => (
              <DCArtboard
                id={key + '-' + sc.key}
                key={sc.key}
                label={sc.label}
                width={W}
                height={H}
              >
                {renderArtboard(theme, sc)}
              </DCArtboard>
            ))}
          </DCSection>
        ))}
      </DesignCanvas>

      <TweaksPanel title="Tweaks">
        <TweakSection label="Typography">
          <TweakSlider label="Font size"   value={tweaks.fontSize}   onChange={v => setTweak('fontSize', v)}   min={11} max={18} step={1} unit="px" />
          <TweakSlider label="Line height" value={tweaks.lineHeight} onChange={v => setTweak('lineHeight', v)} min={1.2} max={1.9} step={0.05} />
        </TweakSection>
        <TweakSection label="Show scenarios">
          <TweakToggle label="Resume"          value={tweaks.showResume}    onChange={v => setTweak('showResume', v)} />
          <TweakToggle label="Streaming"       value={tweaks.showStreaming} onChange={v => setTweak('showStreaming', v)} />
          <TweakToggle label="Plan mode"       value={tweaks.showPlan}      onChange={v => setTweak('showPlan', v)} />
          <TweakToggle label="Approval gate"   value={tweaks.showApproval}  onChange={v => setTweak('showApproval', v)} />
          <TweakToggle label="Typing · slash"  value={tweaks.showTyping}    onChange={v => setTweak('showTyping', v)} />
        </TweakSection>
        <TweakSection label="Design system">
          <TweakButton label="Open token catalog →" onClick={() => window.open('tokens.html', '_blank')} />
        </TweakSection>
      </TweaksPanel>
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
