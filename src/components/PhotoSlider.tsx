import { useEffect, useRef, useState } from 'react';

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
 */
export function PhotoSlider({
  photos,
  interval = 4500,
  label,
  variant = 'card'
}: PhotoSliderProps) {
  const [idx, setIdx] = useState(0);
  const timer = useRef<number | undefined>(undefined);

  // Restart cleanly whenever the photo set changes (a different project).
  useEffect(() => setIdx(0), [photos]);

  useEffect(() => {
    if (photos.length < 2) return;
    const start = () => {
      window.clearInterval(timer.current);
      timer.current = window.setInterval(
        () => setIdx((i) => (i + 1) % photos.length),
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

  return (
    <div className={`pslider pslider-${variant}`}>
      {photos.map((src, i) => (
        <img
          key={src}
          className={`pslide${i === idx ? ' is-on' : ''}`}
          src={src}
          alt={i === idx ? `${label} — photo ${i + 1} of ${photos.length}` : ''}
          // The first slide blocks nothing; the rest load in the background.
          loading={i === 0 ? 'eager' : 'lazy'}
          decoding="async"
          draggable={false}
        />
      ))}
      {photos.length > 1 && (
        <div className="pslider-dots" aria-hidden="true">
          {photos.map((src, i) => (
            <span key={src} className={`pdot${i === idx ? ' is-on' : ''}`} />
          ))}
        </div>
      )}
    </div>
  );
}
