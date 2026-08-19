/**
 * WebGL context-loss recovery for the lobby display.
 *
 * A GPU driver reset, a graphics update, the compositor reclaiming a
 * context under memory pressure — over a run measured in weeks these are
 * not exotic, they are eventual. When it happens the map's canvas goes
 * black and stays black: the HTML markers are separate DOM elements, so
 * the wall is left showing 97 pins and a project index floating over a
 * void, which reads as "broken" rather than "reloading".
 *
 * Neither engine recovers on its own here. Rebuilding the map in place
 * would mean re-creating every marker, layer and handler and hoping the
 * new context survives, so this takes the blunter option: note it, and
 * reload the page. A reload is a second of black on a display nobody is
 * looking at, versus a black map until someone notices.
 *
 * The counter guards against a card that has genuinely given up, where
 * reloading would just produce another lost context in a loop.
 */

const KEY = 'kalb-atlas-gl-recoveries';
const MAX_RECOVERIES = 3;

function count(): number {
  try {
    return Number(sessionStorage.getItem(KEY) ?? '0') || 0;
  } catch {
    return MAX_RECOVERIES;
  }
}

/**
 * Watches a map canvas for context loss. Returns a detach function.
 * `onLost` fires before the reload is scheduled, so the caller can show
 * something; it is not required to do anything.
 */
export function watchGlContext(
  canvas: HTMLCanvasElement | null,
  onLost?: () => void
): () => void {
  if (!canvas) return () => {};

  const lost = (e: Event) => {
    // Preventing the default is what makes a restore event possible at all;
    // without it the context is gone for good.
    e.preventDefault();
    const tries = count();
    console.error(
      `[Kalb Atlas] WebGL context lost (recovery ${tries + 1}/${MAX_RECOVERIES}).`
    );
    onLost?.();
    if (tries >= MAX_RECOVERIES) {
      console.error(
        '[Kalb Atlas] Too many context losses — not reloading again. The ' +
          'GPU or driver on this machine needs attention.'
      );
      return;
    }
    window.setTimeout(() => {
      try {
        sessionStorage.setItem(KEY, String(tries + 1));
      } catch {
        /* no counter available; the guard above already handles that */
      }
      window.location.reload();
    }, 1500);
  };

  const restored = () => {
    console.info('[Kalb Atlas] WebGL context restored by the browser.');
  };

  canvas.addEventListener('webglcontextlost', lost as EventListener);
  canvas.addEventListener('webglcontextrestored', restored);
  return () => {
    canvas.removeEventListener('webglcontextlost', lost as EventListener);
    canvas.removeEventListener('webglcontextrestored', restored);
  };
}

/** A clean run means the GPU is behaving; hand the budget back. */
export function clearGlRecoveryBudget(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
}
