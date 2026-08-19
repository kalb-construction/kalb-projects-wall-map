/**
 * Fetching for an unattended display.
 *
 * The lobby TV boots whenever the building's power or network does, which
 * means its very first request can easily land while the switch is still
 * coming up. A plain `fetch().catch(showError)` turns that half-second of
 * bad luck into a wall that reads "could not read projects.json" until a
 * human walks over with a keyboard — which was the observed behaviour
 * before this existed: one aborted request, no retry, dead until reboot.
 *
 * So: every request gets a deadline, and failure is never final. The caller
 * is told about each failure (so the screen can say what is happening) but
 * the loop keeps going on its own, forever, because on a kiosk there is
 * nobody to press the button.
 */

/** A request that never answers is worse than one that fails: it hangs the boot screen. */
const TIMEOUT_MS = 12_000;

/** Backoff between attempts, capped so a long outage settles into a slow poll. */
const DELAYS_MS = [1_000, 2_000, 4_000, 8_000, 15_000, 30_000];

export interface RetryOptions<T, R> {
  /** Called after each failed attempt, with the 1-based attempt number. */
  onAttemptFailed?: (attempt: number, error: unknown) => void;
  /** Abort the whole loop (e.g. React unmount). */
  signal?: AbortSignal;
  /**
   * Runs on each successful response. Throwing from here counts as a failed
   * attempt and retries, which is what you want for a file that is being
   * rewritten: a half-written projects.json parses to something unusable,
   * and the right response is to wait and read it again rather than to
   * treat the display as broken.
   */
  parse?: (raw: T) => R;
}

/** One attempt, with a deadline. Rejects on timeout, HTTP error, or bad JSON. */
export async function fetchJsonOnce<T>(url: string, signal?: AbortSignal): Promise<T> {
  const timer = new AbortController();
  const id = window.setTimeout(() => timer.abort(), TIMEOUT_MS);
  const onOuterAbort = () => timer.abort();
  signal?.addEventListener('abort', onOuterAbort);
  try {
    const res = await fetch(url, { cache: 'no-store', signal: timer.signal });
    if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    window.clearTimeout(id);
    signal?.removeEventListener('abort', onOuterAbort);
  }
}

/**
 * Keeps trying until it succeeds or the caller aborts. Never rejects for a
 * network reason — only for an abort, which is the caller's own doing.
 */
export async function fetchJsonForever<T, R = T>(
  url: string,
  { onAttemptFailed, signal, parse }: RetryOptions<T, R> = {}
): Promise<R> {
  for (let attempt = 1; ; attempt++) {
    if (signal?.aborted) throw new DOMException('aborted', 'AbortError');
    try {
      const raw = await fetchJsonOnce<T>(url, signal);
      return parse ? parse(raw) : (raw as unknown as R);
    } catch (err) {
      if (signal?.aborted) throw new DOMException('aborted', 'AbortError');
      onAttemptFailed?.(attempt, err);
      const wait = DELAYS_MS[Math.min(attempt - 1, DELAYS_MS.length - 1)];
      await new Promise<void>((resolve) => {
        const t = window.setTimeout(resolve, wait);
        signal?.addEventListener(
          'abort',
          () => {
            window.clearTimeout(t);
            resolve();
          },
          { once: true }
        );
      });
    }
  }
}

/** True when the origin is answering. Used to avoid reloading into a dead network. */
export async function isReachable(url = './version.json'): Promise<boolean> {
  try {
    await fetchJsonOnce(url);
    return true;
  } catch {
    return false;
  }
}
