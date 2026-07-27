import { useEffect, useState } from 'react';
import type { Project } from '../types';
import { statusTone } from '../lib/meta';
import { BuildingHero } from './BuildingHero';

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
    const id = window.setInterval(
      () => setIndex((i) => (i + 1) % featured.length),
      9000
    );
    return () => window.clearInterval(id);
  }, [featured.length]);

  if (featured.length === 0) return null;
  const p = featured[index % featured.length];

  return (
    <div className="attract" aria-hidden="true">
      <div className="attract-inner" key={p.id}>
        <div className="attract-visual">
          <BuildingHero project={p} compact />
        </div>
        <div className="attract-copy">
          <span className="attract-kicker">FEATURED PROJECT</span>
          <span className="attract-number">№ {p.number}</span>
          <h2 className="attract-name">{p.name}</h2>
          <p className="attract-addr">
            {p.address} · {p.city}, {p.state}
          </p>
          <div className="attract-status">
            <span className={`chip chip-status tone-${statusTone(p.status)}`}>
              {p.status}
            </span>
            <div className="progress-track">
              <div
                className={`progress-fill tone-${statusTone(p.status)}`}
                style={{ width: `${p.progress}%` }}
              />
            </div>
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
