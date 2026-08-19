import { useEffect, useState } from 'react';
import type { Project } from '../types';
import { statusTone } from '../lib/meta';
import { PhotoSlider } from './PhotoSlider';

interface IdleAttractProps {
  featured: Project[];
}

/**
 * Kiosk attract loop: cycles through projects while the display is idle.
 * Any touch/movement resets the idle timer upstream, which unmounts this
 * overlay.
 *
 * Every project handed here is expected to have photos — App decides which
 * ones qualify (see `attractProjects`) so that the caller's "should the
 * screensaver run" test and this component's "is there anything to show"
 * test can never disagree. They did once, and the result was a screensaver
 * that mounted and drew nothing.
 */
export function IdleAttract({ featured }: IdleAttractProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    // Hold long enough for a photo set to play through before moving on.
    const hold = featured[index % featured.length]?.photos?.length
      ? 14000
      : 9000;
    const id = window.setTimeout(
      () => setIndex((i) => (i + 1) % featured.length),
      hold
    );
    return () => window.clearTimeout(id);
  }, [featured, index]);

  // Warm the next project's photos while the current one is on screen. Each
  // project's slider mounts only when its turn comes, so without this the
  // first photo starts downloading at the moment it is meant to be visible
  // and the panel shows a half-drawn image on a slow connection.
  useEffect(() => {
    if (featured.length < 2) return;
    const next = featured[(index + 1) % featured.length];
    // Deliberately not cancelled on cleanup: the effect re-runs exactly when
    // that project becomes current, and aborting the fetch there would throw
    // away the download the slider is about to need.
    for (const src of next.photos ?? []) {
      const img = new Image();
      img.decoding = 'async';
      img.src = src;
    }
  }, [featured, index]);

  if (featured.length === 0) return null;
  const p = featured[index % featured.length];

  return (
    <div className="attract" aria-hidden="true">
      <div className="attract-inner" key={p.id}>
        <div className="attract-visual">
          <PhotoSlider
            photos={p.photos!}
            label={p.name}
            interval={3600}
            variant="attract"
          />
        </div>
        <div className="attract-copy">
          <span className="attract-kicker">FEATURED PROJECT</span>
          <span className="attract-number">
            {p.developer === 'blak' ? 'BLAK DEVELOPMENT' : `№ ${p.number}`}
          </span>
          <h2 className="attract-name">{p.name}</h2>
          <p className="attract-addr">
            {p.address} · {p.city}, {p.state}
          </p>
          <div className="attract-status">
            <span className={`chip chip-status tone-${statusTone(p.status)}`}>
              {p.status}
            </span>
            {typeof p.progress === 'number' && (
              <div className="progress-track">
                <div
                  className={`progress-fill tone-${statusTone(p.status)}`}
                  style={{ width: `${p.progress}%` }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="attract-dots">
        {featured.map((f, i) => (
          <span
            key={f.id}
            className={`attract-dot${i === index % featured.length ? ' is-on' : ''}`}
          />
        ))}
      </div>

      <div className="attract-cta">
        <img src="./brand/kalb-k-red.png" alt="" className="attract-k" />
        <span>TOUCH TO EXPLORE THE PROJECT MAP</span>
      </div>
    </div>
  );
}
