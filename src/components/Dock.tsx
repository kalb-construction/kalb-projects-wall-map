import { useState } from 'react';
import type { Filters, Project } from '../types';
import { CATEGORIES, CITY_GROUPS, statusTone } from '../lib/meta';
import { BuildingHero } from './BuildingHero';

interface DockProps {
  filters: Filters;
  onFilters: (f: Filters) => void;
  shownCount: number;
  featured: Project[];
  selectedId: string | null;
  onSelect: (p: Project) => void;
}

type TrayKey = 'city' | 'category' | null;

const TRAY_OPTIONS: Record<Exclude<TrayKey, null>, readonly string[]> = {
  city: CITY_GROUPS,
  category: CATEGORIES
};

const TRAY_LABEL: Record<Exclude<TrayKey, null>, string> = {
  city: 'City',
  category: 'Type'
};

export function Dock({
  filters,
  onFilters,
  shownCount,
  featured,
  selectedId,
  onSelect
}: DockProps) {
  const [tray, setTray] = useState<TrayKey>(null);

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
          {TRAY_OPTIONS[tray].map((opt) => (
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
        <span className="dock-label">Filter</span>
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
        <div className="dock-legend" aria-hidden="true">
          <span className="lg lg-active" /> Project site
          <span className="lg lg-multi">2+</span> Multi-project site
        </div>
      </div>

      <div className="dock-right">
        <span className="dock-label dock-label-feat">Featured</span>
        <div className="feat-rail">
          {featured.map((p) => (
            <button
              key={p.id}
              className={`feat-card${selectedId === p.id ? ' is-active' : ''}`}
              onClick={() => onSelect(p)}
            >
              <div className="feat-visual">
                <BuildingHero project={p} compact />
              </div>
              <div className="feat-info">
                <span className="feat-number">{p.number}</span>
                <span className="feat-name">{p.shortName ?? p.name}</span>
                <span className={`feat-status tone-${statusTone(p.status)}`}>
                  {p.status}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </footer>
  );
}
