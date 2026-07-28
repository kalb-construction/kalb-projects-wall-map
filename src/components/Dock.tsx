import { useState } from 'react';
import type { Filters } from '../types';
import { CATEGORIES } from '../lib/meta';

interface DockProps {
  filters: Filters;
  onFilters: (f: Filters) => void;
  shownCount: number;
  /** Cities present in the data, alphabetical. */
  cityOptions: string[];
  /** Current camera bearing in degrees, for the compass needle. */
  bearing: number;
  /** Snap the camera back to north-up. */
  onNorth: () => void;
}

type TrayKey = 'city' | 'category' | null;

const TRAY_LABEL: Record<Exclude<TrayKey, null>, string> = {
  city: 'City',
  category: 'Type'
};

/** Bottom filter bar: city and project-type chip trays. */
export function Dock({
  filters,
  onFilters,
  shownCount,
  cityOptions,
  bearing,
  onNorth
}: DockProps) {
  const [tray, setTray] = useState<TrayKey>(null);

  const trayOptions: Record<Exclude<TrayKey, null>, readonly string[]> = {
    city: cityOptions,
    category: CATEGORIES
  };

  const isFiltered = filters.city !== 'all' || filters.category !== 'all';

  const setValue = (key: Exclude<TrayKey, null>, value: string) => {
    onFilters({ ...filters, [key]: value });
    setTray(null);
  };

  return (
    <footer className="dock">
      {tray && (
        <div className="tray" role="menu" aria-label={`${TRAY_LABEL[tray]} filter`}>
          <button
            className={`tray-chip${filters[tray] === 'all' ? ' is-active' : ''}`}
            onClick={() => setValue(tray, 'all')}
          >
            All
          </button>
          {trayOptions[tray].map((opt) => (
            <button
              key={opt}
              className={`tray-chip${filters[tray] === opt ? ' is-active' : ''}`}
              onClick={() => setValue(tray, opt)}
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      <div className="dock-left">
        <button
          className={`compass-btn${Math.abs(bearing) > 0.5 ? ' is-turned' : ''}`}
          onClick={onNorth}
          aria-label={`Compass — bearing ${Math.round(bearing)}°, tap to face north`}
          title="Face north"
        >
          <svg viewBox="0 0 44 44" aria-hidden="true">
            <circle className="compass-ring" cx="22" cy="22" r="18" />
            <g transform={`rotate(${-bearing} 22 22)`}>
              {/* north half — Kalb red */}
              <path className="compass-n" d="M22 6 L28.5 25 L22 21.5 L15.5 25 Z" />
              {/* south half — sand */}
              <path className="compass-s" d="M22 38 L15.5 19 L22 22.5 L28.5 19 Z" />
            </g>
            <text className="compass-label" x="22" y="12.5">N</text>
          </svg>
        </button>
        {(['city', 'category'] as const).map((key) => (
          <button
            key={key}
            className={`dock-filter${filters[key] !== 'all' ? ' is-set' : ''}${
              tray === key ? ' is-open' : ''
            }`}
            onClick={() => setTray(tray === key ? null : key)}
            aria-expanded={tray === key}
          >
            {filters[key] === 'all' ? TRAY_LABEL[key] : filters[key]}
            <svg viewBox="0 0 12 8" aria-hidden="true">
              <path
                d="M1 6.5 6 1.5 11 6.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        ))}
        {isFiltered && (
          <button
            className="dock-clear"
            onClick={() =>
              onFilters({ city: 'all', category: 'all', status: 'all' })
            }
          >
            Clear
          </button>
        )}
        <span className="dock-count">{shownCount} shown</span>
      </div>
    </footer>
  );
}
