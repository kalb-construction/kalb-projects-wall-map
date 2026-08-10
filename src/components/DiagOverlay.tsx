import { useEffect, useRef } from 'react';

/**
 * On-screen diagnostics, enabled with `?diag=1` in the URL. Built for the
 * kiosk, where there is no keyboard for DevTools: shows the live map
 * engine, devicePixelRatio (1.5 = the render cap is active), the actual
 * canvas render ratio, and a frames-per-second counter.
 *
 * Updates once per second by writing textContent directly — the overlay
 * itself must not add per-frame React work to the thing it measures.
 */
export function DiagOverlay({ engine }: { engine: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let frames = 0;
    let last = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      frames += 1;
      if (now - last >= 1000) {
        const fps = Math.round((frames * 1000) / (now - last));
        frames = 0;
        last = now;
        const c = document.querySelector(
          '.map-stage canvas'
        ) as HTMLCanvasElement | null;
        const ratio =
          c && c.clientWidth > 0 ? (c.width / c.clientWidth).toFixed(2) : '—';
        if (ref.current) {
          ref.current.textContent =
            `${engine}  ·  dpr ${window.devicePixelRatio}  ·  ` +
            `render ${ratio}×  ·  ${fps} fps  ·  ` +
            `${window.innerWidth}×${window.innerHeight}`;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [engine]);

  return <div className="diag" ref={ref} aria-hidden="true" />;
}
