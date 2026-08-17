import { useEffect, useState } from 'react';
import type { Project } from '../types';
import { statusTone } from '../lib/meta';
import { BuildingHero } from './BuildingHero';
import { PhotoSlider } from './PhotoSlider';

interface IdleAttractProps {
  featured: Project[];
}

/**
 * Kiosk attract loop: cycles through featured projects while the display
 * is idle. Any touch/movement resets the idle timer upstream, which
 * unmounts this overlay.
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

  if (featured.length === 0) return null;
  const p = featured[index % featured.length];

  return (
    <div className="attract" aria-hidden="true">
      <div className="attract-inner" key={p.id}>
        <div className="attract-visual">
          {p.photos && p.photos.length > 0 ? (
            <PhotoSlider
              photos={p.photos}
              label={p.name}
              interval={3600}
              variant="attract"
            />
          ) : (
            <BuildingHero project={p} compact />
          )}
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
