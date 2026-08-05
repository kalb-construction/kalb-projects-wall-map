import { memo, useState } from 'react';
import type { Filters } from '../types';
import { CATEGORIES, STATUSES } from '../lib/meta';
import { Compass } from './Compass';

interface DockProps {
  filters: Filters;
  onFilters: (f: Filters) => void;
  shownCount: number;
  /** Cities present in the data, alphabetical. */
  cityOptions: string[];
  /** Snap the camera back to north-up. */
  onNorth: () => void;
}

type TrayKey = 'city' | 'category' | 'status' | null;

const TRAY_LABEL: Record<Exclude<TrayKey, null>, string> = {
  city: 'City',
  category: 'Type',
  status: 'Status'
};

/** Bottom filter bar: city and project-type chip trays. */
function DockBase({
  filters,
  onFilters,
  shownCount,
  cityOptions,
  onNorth
}: DockProps) {
  const [tray, setTray] = useState<TrayKey>(null);

  const trayOptions: Record<Exclude<TrayKey, null>, readonly string[]> = {
    city: cityOptions,
    category: CATEGORIES,
    status: STATUSES
  };

  const isFiltered =
    filters.city !== 'all' ||
    filters.category !== 'all' ||
    filters.status !== 'all';

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
        <Compass onNorth={onNorth} />
        {(['city', 'category', 'status'] as const).map((key) => (
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

/** Memoized: only re-renders when its own props actually change. */
export const Dock = memo(DockBase);
