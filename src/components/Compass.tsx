import { useBearing } from '../lib/bearing';

/**
 * Live compass. Subscribes to the bearing store directly so a spinning
 * camera re-renders this 44px SVG and nothing else.
 */
export function Compass({ onNorth }: { onNorth: () => void }) {
  const bearing = useBearing();
  const norm = ((bearing % 360) + 360) % 360;
  const turned = norm > 0.5 && norm < 359.5;

  return (
    <button
      className={`compass-btn${turned ? ' is-turned' : ''}`}
      onClick={onNorth}
      aria-label={`Compass — bearing ${Math.round(bearing)}°, tap to face north`}
      title="Face north"
    >
      <svg viewBox="0 0 44 44" aria-hidden="true">
        <circle className="compass-ring" cx="22" cy="22" r="18" />
        <g style={{ transform: `rotate(${-bearing}deg)`, transformOrigin: '22px 22px' }}>
          <path className="compass-n" d="M22 6 L28.5 25 L22 21.5 L15.5 25 Z" />
          <path className="compass-s" d="M22 38 L15.5 19 L22 22.5 L28.5 19 Z" />
        </g>
        <text className="compass-label" x="22" y="12.5">
          N
        </text>
      </svg>
    </button>
  );
}
