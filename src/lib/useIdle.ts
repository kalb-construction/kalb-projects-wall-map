import { useEffect, useRef, useState } from 'react';

const ACTIVITY: Array<keyof WindowEventMap> = [
  'pointerdown',
  'pointermove',
  'keydown',
  'wheel',
  'touchstart'
];

/**
 * Idle escalation ladder. Returns how many of `stages` (ascending
 * milliseconds) have passed with no interaction: 0 while somebody is using
 * the wall, 1 once the first threshold is crossed, 2 once the second is,
 * and so on.
 *
 * The listeners only stamp a timestamp — no React state is touched on a
 * mouse move — and a single one-second interval reads it. That matters on
 * a display that stays open for weeks: the obvious implementation clears
 * and re-arms a timeout on every `pointermove`, which is hundreds of timer
 * operations a second while somebody is panning the map.
 *
 * One-second resolution is deliberate. Every threshold here is measured in
 * tens of seconds, so a second either way is invisible, and the cost is
 * one wakeup per second instead of one per input event.
 */
export function useIdleStage(stages: readonly number[]): number {
  const [stage, setStage] = useState(0);
  const lastRef = useRef(Date.now());
  // Join the thresholds so a caller can pass an array literal inline
  // without re-arming the ladder on every render.
  const key = stages.join(',');

  useEffect(() => {
    const thresholds = key.split(',').map(Number);
    const stamp = () => {
      lastRef.current = Date.now();
    };
    ACTIVITY.forEach((e) => window.addEventListener(e, stamp, { passive: true }));

    // A display waking from sleep has been "idle" for hours by the clock,
    // but nobody has seen it. Treat the wake as activity.
    const onVisible = () => {
      if (document.visibilityState === 'visible') stamp();
    };
    document.addEventListener('visibilitychange', onVisible);

    const id = window.setInterval(() => {
      const quiet = Date.now() - lastRef.current;
      let reached = 0;
      for (const t of thresholds) if (quiet >= t) reached += 1;
      setStage(reached);
    }, 1000);

    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      ACTIVITY.forEach((e) => window.removeEventListener(e, stamp));
    };
  }, [key]);

  return stage;
}

/** Returns true once nothing has happened for `timeoutMs`. */
export function useIdle(timeoutMs: number): boolean {
  return useIdleStage([timeoutMs]) > 0;
}

export function useClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 15_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}
