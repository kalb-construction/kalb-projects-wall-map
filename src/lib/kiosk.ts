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
