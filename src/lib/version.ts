/**
 * Keeps a long-running window on the current build.
 *
 * The lobby display runs for weeks and an installed desktop app often sits
 * open for days. Neither ever re-fetches the page on its own, so a deploy
 * would go unseen until someone restarted it. This polls the build id that
 * vite.config.ts emits into version.json and reports when it changes; the
 * caller decides when to act on it (see App.tsx — it waits for the kiosk to
 * be idle so a reload never interrupts someone mid-look).
 *
 * A fresh launch is a separate concern and is handled by cache headers:
 * vercel.json serves index.html and version.json as no-store, while the
 * hashed files under /assets are immutable.
 */

/** How often to ask. Cheap — version.json is a few dozen bytes. */
const POLL_MS = 15 * 60 * 1000;

/** Don't act on an update until the page has settled. */
const MIN_UPTIME_MS = 60 * 1000;

async function fetchBuildId(): Promise<string | null> {
  try {
    const res = await fetch('./version.json', { cache: 'no-store' });
    if (!res.ok) return null;
    const data = (await res.json()) as { build?: string };
    return typeof data.build === 'string' ? data.build : null;
  } catch {
    // Offline or a blip — try again on the next tick.
    return null;
  }
}

/**
 * Starts polling. `onUpdate` fires once, when the deployed build differs
 * from the one this page loaded. Returns a stop function.
 */
export function watchForUpdates(onUpdate: () => void): () => void {
  const startedAt = Date.now();
  let loaded: string | null = null;
  let notified = false;
  let timer: number | undefined;

  const check = async () => {
    const build = await fetchBuildId();
    if (build === null) return;
    if (loaded === null) {
      loaded = build;
      return;
    }
    if (build !== loaded && !notified && Date.now() - startedAt > MIN_UPTIME_MS) {
      notified = true;
      console.info('[Kalb Atlas] New build available — reloading when idle.');
      onUpdate();
    }
  };

  void check();
  timer = window.setInterval(() => void check(), POLL_MS);

  // A kiosk machine that wakes from sleep should check immediately rather
  // than waiting out the rest of the interval.
  const onVisible = () => {
    if (document.visibilityState === 'visible') void check();
  };
  document.addEventListener('visibilitychange', onVisible);

  return () => {
    window.clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisible);
  };
}
