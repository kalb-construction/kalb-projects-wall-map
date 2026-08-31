/**
 * TV / kiosk display tuning, all driven by URL parameters so a display can
 * be adjusted without a rebuild — the kiosk shortcut just carries them.
 *
 *   ?overscan=3   inset all chrome by 3% of the shorter screen edge, so
 *                 nothing is clipped by a TV that crops its own picture.
 *                 The map still bleeds edge to edge (cropping a map's
 *                 outer few pixels costs nothing; clipping the index rail
 *                 or the clock costs everything).
 *   ?dpr=2        raise the render-resolution cap from the 1.5 default.
 *                 Sharper, heavier. `?dpr=1` is the cheapest and softest.
 *   ?red=8f0011   override Kalb red everywhere — the logo, the pins, the
 *                 chips, the progress bar. A television that reproduces a
 *                 deep red poorly can be compensated for from the address
 *                 bar instead of a rebuild, so a value can be judged on
 *                 the wall in the time it takes to type it.
 *   ?diag=1       on-screen engine / dpr / fps readout.
 *
 * See DEPLOY.md → "Pointing the lobby display at it".
 */

const params = new URLSearchParams(window.location.search);

function num(key: string, min: number, max: number): number | null {
  const raw = params.get(key);
  if (raw === null) return null;
  const v = Number(raw);
  if (!Number.isFinite(v)) return null;
  return Math.min(Math.max(v, min), max);
}

/** Percent of the shorter screen edge to keep clear of chrome (0–12). */
export const OVERSCAN_PCT = num('overscan', 0, 12) ?? 0;

/** Render-resolution cap; 1.5 is the tuned default (see lib/dpr.ts). */
export const DPR_CAP = num('dpr', 1, 4) ?? 1.5;

/**
 * Publishes the overscan inset as a CSS variable that every chrome rule
 * adds to its edge offset. Recomputed on resize because it is relative to
 * the screen, not a fixed pixel count.
 */
export function applyKioskInsets(): void {
  if (OVERSCAN_PCT <= 0) return;
  const set = () => {
    const shorter = Math.min(window.innerWidth, window.innerHeight);
    const inset = Math.round((shorter * OVERSCAN_PCT) / 100);
    document.documentElement.style.setProperty('--oi', `${inset}px`);
  };
  set();
  window.addEventListener('resize', set);
}

/** True when the document is currently presented full-screen. */
export function isFullscreen(): boolean {
  return document.fullscreenElement !== null;
}

/**
 * Toggle full-screen. Returns a promise that settles either way — a
 * rejected request (browser policy, unsupported) must not throw into the
 * click handler.
 */
export async function toggleFullscreen(): Promise<void> {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
  } catch {
    /* denied or unsupported — the button simply does nothing */
  }
}

/**
 * `?red=RRGGBB` — Kalb red, overridden for this display.
 *
 * Deep reds are the first thing a mis-set television gets wrong: lift the
 * black level and #C10016 arrives as pink. That is a panel problem, not a
 * markup one, but the panel is not always ours to fix, so the value it is
 * sent can be moved instead. Null unless a valid six-digit hex is given —
 * a typo must never blank every red on the wall.
 */
export const RED_OVERRIDE: string | null = (() => {
  const raw = params.get('red');
  if (raw === null) return null;
  const hex = raw.trim().replace(/^#/, '');
  return /^[0-9a-fA-F]{6}$/.test(hex) ? `#${hex.toLowerCase()}` : null;
})();

/** Kalb red as this display should draw it. */
export const KALB_RED_ACTIVE = RED_OVERRIDE ?? '#C10016';

/**
 * Publish the override as CSS. The derived reds are recomputed from it
 * rather than left at their old values, or a darker override would keep a
 * glow tuned for the colour it replaced.
 */
export function applyRedOverride(): void {
  if (!RED_OVERRIDE) return;
  const hex = RED_OVERRIDE.slice(1);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const darker = (f: number) =>
    '#' +
    [r, g, b]
      .map((c) => Math.round(c * f).toString(16).padStart(2, '0'))
      .join('');
  const root = document.documentElement.style;
  root.setProperty('--red', RED_OVERRIDE);
  root.setProperty('--kalb-red', RED_OVERRIDE);
  root.setProperty('--red-deep', darker(0.72));
  root.setProperty('--red-glow', `rgba(${r}, ${g}, ${b}, 0.55)`);
  console.info(`[Kalb Atlas] Kalb red overridden to ${RED_OVERRIDE}.`);
}

/**
 * Colour calibration screen, opened with `?cal=1`.
 *
 * A display can render a colour correctly and still show the wrong one.
 * When the wall looked pink, the stylesheet, the computed styles and the
 * rendered pixels all measured bit-exact #C10016 — so the shift was
 * happening in the panel, and no amount of editing CSS was going to move
 * it. Describing a colour to each other over chat had already failed
 * twice. This puts the candidates on the wall itself, at size, so the
 * answer is something you look at rather than something we argue about.
 */
export const CALIBRATE: boolean = (() => {
  const raw = params.get('cal');
  return raw !== null && raw !== '0' && raw !== 'false';
})();
