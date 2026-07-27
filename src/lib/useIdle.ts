import { useEffect, useRef, useState } from 'react';

/**
 * Returns true once no pointer/key activity has occurred for `timeoutMs`.
 * Any interaction resets the timer and clears the idle state.
 */
export function useIdle(timeoutMs: number): boolean {
  const [idle, setIdle] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const arm = () => {
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setIdle(true), timeoutMs);
    };
    const onActivity = () => {
      setIdle(false);
      arm();
    };
    const events: Array<keyof WindowEventMap> = [
      'pointerdown',
      'pointermove',
      'keydown',
      'wheel',
      'touchstart'
    ];
    events.forEach((e) =>
      window.addEventListener(e, onActivity, { passive: true })
    );
    arm();
    return () => {
      window.clearTimeout(timer.current);
      events.forEach((e) => window.removeEventListener(e, onActivity));
    };
  }, [timeoutMs]);

  return idle;
}

export function useClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 15_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}
