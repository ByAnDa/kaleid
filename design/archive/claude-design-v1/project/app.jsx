// kaleid TUI — design canvas app
// Renders 2 themes (light = Daylight, dark = Spectrum) × 2 screens
// (Resume + Main chat). Both themes are derived from a single design-token
// source: kaleid-tokens.js → themeFromTokens(modeKey).

const KALEID_TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "fontSize": 14,
  "lineHeight": 1.55,
  "asciiBoxOverride": "auto"
}/*EDITMODE-END*/;

const ARTBOARD_W = 1280;
const ARTBOARD_H = 760;

function App() {
  const [tweaks, setTweak] = useTweaks(KALEID_TWEAK_DEFAULTS);

  const lightTheme = React.useMemo(() => window.themeFromTokens('light'), []);
  const darkTheme  = React.useMemo(() => window.themeFromTokens('dark'),  []);

  const resolveBox = (theme) => {
    if (tweaks.asciiBoxOverride === 'on')  return true;
    if (tweaks.asciiBoxOverride === 'off') return false;
    return theme.boxDrawing === 'full';
  };

  const variants = [
    { key: 'daylight', theme: lightTheme, title: 'Daylight', subtitle: 'light mode default · 浅色亮屏，温润纸质感' },
    { key: 'spectrum', theme: darkTheme,  title: 'Spectrum', subtitle: 'dark mode default · 深色，多彩角色色条 gutter' },
  ];

  return (
    <React.Fragment>
      <DesignCanvas>
        {variants.map(({ key, theme, title, subtitle }) => (
          <DCSection id={key} key={key} title={title} subtitle={subtitle}>
            <DCArtboard id={key + '-resume'} label="Resume" width={ARTBOARD_W} height={ARTBOARD_H}>
              <ResumeScreen theme={theme} fontSize={tweaks.fontSize} lineHeight={tweaks.lineHeight} showBox={resolveBox(theme)} />
            </DCArtboard>
            <DCArtboard id={key + '-chat'} label="Main chat" width={ARTBOARD_W} height={ARTBOARD_H}>
              <ChatScreen theme={theme} fontSize={tweaks.fontSize} lineHeight={tweaks.lineHeight} showBox={resolveBox(theme)} />
            </DCArtboard>
          </DCSection>
        ))}
      </DesignCanvas>

      <TweaksPanel title="Tweaks">
        <TweakSection label="Typography">
          <TweakSlider label="Font size"   value={tweaks.fontSize}   onChange={(v) => setTweak('fontSize', v)}   min={11} max={18}  step={1}    unit="px" />
          <TweakSlider label="Line height" value={tweaks.lineHeight} onChange={(v) => setTweak('lineHeight', v)} min={1.2} max={1.9} step={0.05} />
        </TweakSection>
        <TweakSection label="Frame chrome">
          <TweakRadio
            label="ASCII box drawing"
            value={tweaks.asciiBoxOverride}
            onChange={(v) => setTweak('asciiBoxOverride', v)}
            options={[
              { value: 'auto', label: 'theme default' },
              { value: 'on',   label: 'always on' },
              { value: 'off',  label: 'never' },
            ]}
          />
        </TweakSection>
        <TweakSection label="Design tokens">
          <TweakButton label="Open token catalog →" onClick={() => window.open('tokens.html', '_blank')} />
        </TweakSection>
      </TweaksPanel>
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
