import { memo, useState } from 'react';
import { BLAK_GREEN } from '../lib/brand';

interface BlakBadgeProps {
  /** How many BLAK projects are on the map right now. */
  count: number;
  /** True while BLAK is the active legend filter. */
  active: boolean;
  onToggle: () => void;
}

/**
 * BLAK Development mark, floating bottom-left over the map. Tapping it
 * filters the wall to BLAK's projects — the same action as the BLAK row in
 * the legend, but reachable without opening the index.
 *
 * The real logo file is optional: drop it at public/brand/blak-logo.png and
 * it appears automatically. Until then the wordmark stands in, so a missing
 * asset never leaves a broken image on the wall.
 */
function BlakBadgeBase({ count, active, onToggle }: BlakBadgeProps) {
  const [logoOk, setLogoOk] = useState(true);

  return (
    <button
      className={`blak-badge${active ? ' is-active' : ''}`}
      onClick={onToggle}
      aria-pressed={active}
      aria-label={`BLAK Development — ${count} projects. Tap to show only these.`}
      style={{ '--blak': BLAK_GREEN } as React.CSSProperties}
    >
      {logoOk ? (
        <img
          className="blak-logo"
          src="./brand/blak-logo.png"
          alt="BLAK Development"
          onError={() => setLogoOk(false)}
          draggable={false}
        />
      ) : (
        <span className="blak-wordmark" aria-hidden="true">
          BLAK
        </span>
      )}
      <span className="blak-meta">
        <span className="blak-name">DEVELOPMENT</span>
        <span className="blak-count">{count} projects</span>
      </span>
    </button>
  );
}

export const BlakBadge = memo(BlakBadgeBase);
