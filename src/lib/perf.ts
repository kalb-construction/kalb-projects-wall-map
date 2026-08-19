/**
 * Performance floor for weak displays.
 *
 * The wall was tuned on a PC driving a TV. Run the same page in a smart
 * TV's own browser and the hardware is a different class entirely — a
 * phone-grade GPU from several years ago, asked to render a 3D vector map
 * at 1080p. It does not cope, and the failure is the worst kind: not a
 * crash, just a permanently stuttering map that makes the whole wall look
 * cheap.
 *
 * So the app measures itself and gives up the expensive things when it has
 * to. Lite mode drops, in rough order of what each one costs:
 *
 *   - render resolution to 1× (from 1.5×, so 2.25× fewer pixels a frame)
 *   - camera pitch to flat, which stops 3D building extrusion entirely
 *   - the idle orbit, which re-renders the whole map every single frame
 *   - the activity heat layer
 *   - CSS animation, transitions and shadows (see .perf-lite in global.css)
 *
 * `?lite=1` forces it on for a display you already know is weak, `?lite=0`
 * forces it off. Left alone it decides for itself.
 */

const params = new URLSearchParams(window.location.search);
const forced = params.get('lite');

/** Explicitly demanded — skip measuring and start degraded. */
export const LITE_FORCED = forced !== null && forced !== '0' && forced !== 'false';
/** Explicitly refused — never auto-degrade, whatever the frame rate. */
export const LITE_REFUSED = forced === '0' || forced === 'false';

/** Sustained frames per second below which the display is judged unable. */
const FLOOR_FPS = 26;
/** Consecutive bad seconds before degrading. */
const BAD_SECONDS = 5;
/** Ignore the first seconds: tiles, fonts and photos are still landing. */
const WARMUP_MS = 9000;

let applied = false;

/** True once the app has dropped to lite mode, however it got there. */
export function isLite(): boolean {
  return applied;
}

function apply(reason: string): void {
  if (applied) return;
  applied = true;
  document.documentElement.classList.add('perf-lite');
  window.dispatchEvent(new CustomEvent('kalb-lite'));
  console.info(`[Kalb Atlas] Lite mode: ${reason}.`);
}

/**
 * Watch the frame rate and degrade if the display cannot keep up.
 *
 * Deliberately one-way. A map that has just shed its 3D geometry will
 * report a healthy frame rate immediately, so anything that could switch
 * back would oscillate — smooth, heavy, stutter, light, smooth — which
 * reads far worse on a wall than simply staying in lite.
 *
 * Returns a stop function.
 */
export function watchPerformance(): () => void {
  if (LITE_FORCED) {
    apply('forced by ?lite=1');
    return () => {};
  }
  if (LITE_REFUSED) return () => {};

  const started = performance.now();
  let frames = 0;
  let windowStart = performance.now();
  let badSeconds = 0;
  let raf = 0;
  let stopped = false;

  const tick = (now: number) => {
    if (stopped) return;
    frames += 1;
    const elapsed = now - windowStart;
    if (elapsed >= 1000) {
      const fps = (frames * 1000) / elapsed;
      frames = 0;
      windowStart = now;
      if (now - started > WARMUP_MS) {
        // A tab in the background throttles to ~1fps by design; that is
        // not a slow display and must not trip the detector.
        if (document.visibilityState === 'visible' && fps < FLOOR_FPS) {
          badSeconds += 1;
          if (badSeconds >= BAD_SECONDS) {
            apply(`sustained ${Math.round(fps)} fps`);
            stopped = true;
            return;
          }
        } else {
          badSeconds = 0;
        }
      }
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  return () => {
    stopped = true;
    cancelAnimationFrame(raf);
  };
}
