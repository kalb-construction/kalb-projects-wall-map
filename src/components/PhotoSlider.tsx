import { useCallback, useEffect, useRef, useState } from 'react';

interface PhotoSliderProps {
  photos: string[];
  /** Milliseconds each photo is held before the crossfade. */
  interval?: number;
  /** Alt text base — the slide number is appended. */
  label: string;
  /** Larger dots + slower pace for the attract loop. */
  variant?: 'card' | 'attract';
}

/**
 * Auto-advancing photo crossfade.
 *
 * Every slide is in the DOM from the start and only `opacity` changes, so
 * the browser can composite the transition on the GPU — no layout, no
 * decode stall mid-fade, and nothing that fights the map for frame time.
 * The timer is paused whenever the tab is hidden, so a kiosk that has been
 * asleep doesn't wake up and burn through the set.
 *
 * The loop never advances onto a photo that hasn't finished downloading —
 * it holds the current one and tries again on the next tick. Without that,
 * a slow slide fades in as an empty box, which on the wall display reads as
 * a broken photo rather than a slow one.
 */
export function PhotoSlider({
  photos,
  interval = 4500,
  label,
  variant = 'card'
}: PhotoSliderProps) {
  const [idx, setIdx] = useState(0);
  const [ready, setReady] = useState<Set<number>>(() => new Set());
  /**
   * Photos that failed to load. A file can go missing for reasons that
   * have nothing to do with this component — a job removed from the data,
   * a path corrected, a request lost — and a slide that cannot be drawn
   * must leave the rotation rather than take its turn as an empty frame
   * on a wall nobody is standing at.
   */
  const [broken, setBroken] = useState<Set<number>>(() => new Set());
  const timer = useRef<number | undefined>(undefined);
  const readyRef = useRef(ready);
  readyRef.current = ready;
  const brokenRef = useRef(broken);
  brokenRef.current = broken;

  // Restart cleanly whenever the photo set changes (a different project).
  useEffect(() => {
    setIdx(0);
    setReady(new Set());
    setBroken(new Set());
  }, [photos]);

  const markBroken = useCallback((i: number) => {
    setBroken((prev) => {
      if (prev.has(i)) return prev;
      const next = new Set(prev);
      next.add(i);
      return next;
    });
  }, []);

  const markReady = useCallback((i: number) => {
    setReady((prev) => {
      if (prev.has(i)) return prev;
      const next = new Set(prev);
      next.add(i);
      return next;
    });
  }, []);

  useEffect(() => {
    if (photos.length < 2) return;
    const start = () => {
      window.clearInterval(timer.current);
      timer.current = window.setInterval(
        () =>
          setIdx((i) => {
            // Walk forward to the next slide that is loaded and not
            // broken. A full lap without finding one means nothing is
            // showable yet, so hold and let the next tick retry.
            for (let step = 1; step <= photos.length; step++) {
              const next = (i + step) % photos.length;
              if (brokenRef.current.has(next)) continue;
              if (readyRef.current.has(next)) return next;
              break; // not broken, just not loaded — wait for it
            }
            return i;
          }),
        interval
      );
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') start();
      else window.clearInterval(timer.current);
    };
    start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(timer.current);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [photos, interval]);

  if (photos.length === 0) return null;
  // Every photo failed: render nothing so the caller's panel is empty by
  // design rather than showing a frame of broken images.
  if (broken.size >= photos.length) return null;

  return (
    <div className={`pslider pslider-${variant}`}>
      {photos.map((src, i) => (
        <img
          key={src}
          className={`pslide${i === idx && !broken.has(i) ? ' is-on' : ''}`}
          src={src}
          alt={i === idx ? `${label} — photo ${i + 1} of ${photos.length}` : ''}
          /* The attract loop is full-screen and every slide is shown within
             seconds, so there is nothing to defer; a card's slider may never
             be looked at, so there the rest load in the background. */
          loading={variant === 'attract' || i === 0 ? 'eager' : 'lazy'}
          decoding="async"
          draggable={false}
          onLoad={() => markReady(i)}
          onError={() => markBroken(i)}
          ref={(el) => {
            // A cached image can finish before React attaches onLoad.
            if (el?.complete && el.naturalWidth > 0) markReady(i);
          }}
        />
      ))}
      {photos.length - broken.size > 1 && (
        <div className="pslider-dots" aria-hidden="true">
          {photos.map((src, i) =>
            broken.has(i) ? null : (
              <span key={src} className={`pdot${i === idx ? ' is-on' : ''}`} />
            )
          )}
        </div>
      )}
    </div>
  );
}
