/**
 * Find the red that this particular panel draws as Kalb red.
 *
 * The wall reads pink on the TV. Every measurement says the app is right:
 * every red in the stylesheet is #C10016, every computed style resolves to
 * rgb(193, 0, 22), and 62% of the red pixels in a rendered frame are that
 * value bit for bit, with the rest its own darker shade. A colour that
 * leaves the browser correct and arrives on the wall wrong is being
 * changed by the display, and there is nothing to fix in CSS.
 *
 * Two things can be true: the panel needs configuring, or we send it a
 * pre-compensated red that lands on brand once the panel has had its way.
 * This screen tells them apart and answers both, without anyone having to
 * describe a colour in words.
 *
 * The neutral strip is the important half. If the greys are clean and only
 * the reds are off, a compensated red is a real fix. If the greys are
 * pink too, the panel is tinting everything, every photograph on the wall
 * is off as well, and shipping a bent red would only paper over it — that
 * has to be fixed in the TV's own settings.
 *
 * Everything here is a flat fill: no gradient, no shadow, no blur, no
 * animation, no transparency. Nothing our own render could be blamed for.
 */

const TARGET = '#C10016';

/**
 * Candidates, spanning the two ways a panel makes red look pink: it
 * lightens (so the ladder darkens) and it pushes blue (so the ladder
 * strips blue out). Whichever it is doing, one of these lands on brand.
 */
const ROWS: Array<{ note: string; swatches: Array<[string, string]> }> = [
  {
    note: 'Brand blue level — try these if the red looks washed out but not purple',
    swatches: [
      ['A', '#C10016'],
      ['B', '#AE0014'],
      ['C', '#9B0012'],
      ['D', '#8C0011']
    ]
  },
  {
    note: 'Half the blue — try these if the red looks slightly purple or magenta',
    swatches: [
      ['E', '#C1000B'],
      ['F', '#AE000A'],
      ['G', '#9B0009'],
      ['H', '#8C0008']
    ]
  },
  {
    note: 'No blue at all — try these if the red looks clearly pink',
    swatches: [
      ['J', '#C10000'],
      ['K', '#AE0000'],
      ['L', '#9B0000'],
      ['M', '#8C0000']
    ]
  }
];

/** Controls. If these look tinted, the panel is wrong, not the red. */
const NEUTRALS: Array<[string, string]> = [
  ['White', '#FFFFFF'],
  ['Light grey', '#B4B4B4'],
  ['Mid grey', '#6E6E6E'],
  ['Dark grey', '#2A2A2A'],
  ['Black', '#000000']
];

export default function RedCalibration() {
  return (
    <div
      style={{
        // Normal document flow, not a fixed pane with its own scrollbar:
        // a TV remote's arrow keys scroll the page, and a nested scroll
        // container is a box they cannot reach into.
        minHeight: '100vh',
        background: '#101010',
        color: '#FFFFFF',
        font: '500 15px/1.45 system-ui, -apple-system, Segoe UI, sans-serif',
        padding: '14px 18px 24px',
        boxSizing: 'border-box'
      }}
    >
      <h1 style={{ margin: '0 0 4px', fontSize: 19, letterSpacing: '0.02em' }}>
        Kalb red — panel calibration
      </h1>
      <p style={{ margin: '0 0 12px', color: '#B9B9B9', maxWidth: 760 }}>
        Hold something printed in Kalb red — a business card, letterhead, the
        van — against the screen. Find the swatch that matches it and tell me
        its letter.
      </p>

      {/* Controls first: they decide whether a compensated red is even the
          right answer, so they should be read before the reds. */}
      <h2 style={{ fontSize: 13, letterSpacing: '0.14em', margin: '0 0 8px', color: '#8F8F8F' }}>
        STEP 1 — ARE THESE GREYS CLEAN?
      </h2>
      <div style={{ display: 'flex', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
        {NEUTRALS.map(([label, hex]) => (
          <div key={hex} style={{ width: 118 }}>
            <div
              style={{
                background: hex,
                height: 52,
                border: '1px solid #444',
                boxSizing: 'border-box'
              }}
            />
            <div style={{ fontSize: 12, color: '#9A9A9A', paddingTop: 4 }}>{label}</div>
          </div>
        ))}
      </div>
      <p style={{ margin: '0 0 16px', color: '#E0A0A8', maxWidth: 900, fontSize: 13 }}>
        If any of those greys look pink, warm or tinted, stop here — the TV is
        colouring everything, including every project photo on the wall. Fix it
        in the TV's picture menu rather than in the app: set{' '}
        <b>Colour Temperature</b> to <b>Warm</b>, <b>Picture Mode</b> to{' '}
        <b>Movie</b> or <b>Standard</b> (never <b>Vivid</b> or{' '}
        <b>Dynamic</b>), <b>Colour Space</b>/<b>Gamut</b> to <b>Auto</b> or{' '}
        <b>sRGB</b> (never <b>Native</b> or <b>Wide</b>), and turn off{' '}
        <b>HDR</b>, <b>Dynamic Contrast</b> and any <b>Colour Enhancement</b>.
      </p>

      <h2 style={{ fontSize: 13, letterSpacing: '0.14em', margin: '0 0 8px', color: '#8F8F8F' }}>
        STEP 2 — WHICH RED MATCHES THE PRINTED LOGO?
      </h2>
      {ROWS.map((row) => (
        <div key={row.note} style={{ marginBottom: 11 }}>
          <div style={{ fontSize: 12.5, color: '#9A9A9A', marginBottom: 6 }}>{row.note}</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {row.swatches.map(([letter, hex]) => (
              <div key={letter} style={{ width: 118 }}>
                <div
                  style={{
                    background: hex,
                    height: 78,
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'space-between',
                    padding: '0 7px 5px',
                    boxSizing: 'border-box',
                    color: '#FFFFFF',
                    fontSize: 12,
                    fontWeight: 700
                  }}
                >
                  <span style={{ fontSize: 22 }}>{letter}</span>
                  <span>{hex.slice(1)}</span>
                </div>
                {hex === TARGET && (
                  <div style={{ fontSize: 12, color: '#9A9A9A', paddingTop: 4 }}>
                    what the app sends now
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      <h2 style={{ fontSize: 13, letterSpacing: '0.14em', margin: '14px 0 8px', color: '#8F8F8F' }}>
        STEP 3 — TRY IT ON THE REAL WALL
      </h2>
      <p style={{ margin: 0, color: '#B9B9B9', maxWidth: 760 }}>
        Add <code style={{ color: '#fff' }}>?red=</code> and the six characters
        from the swatch to the normal address — for example{' '}
        <code style={{ color: '#fff' }}>
          kalb-projects-wall-map.vercel.app/?red=AE000A
        </code>{' '}
        — and the whole map redraws in that red. Once one looks right on the
        wall, tell me and I will make it the default so the kiosk needs no
        special address.
      </p>
    </div>
  );
}
