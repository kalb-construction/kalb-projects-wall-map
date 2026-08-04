import { memo, useState } from 'react';
import type { Project } from '../types';
import { REGIONS, type BBox } from '../lib/regions';

interface RegionNavProps {
  projects: Project[];
  visibleIds: Set<string>;
  onFly: (bounds: BBox) => void;
}

/**
 * Collapsible quick-nav: one tap flies the camera to each Kalb region
 * (Las Vegas Valley, Northern Nevada, Arizona).
 */
function RegionNavBase({ projects, visibleIds, onFly }: RegionNavProps) {
  const [open, setOpen] = useState(false);

  return (
    <nav className={`region-nav${open ? ' is-open' : ''}`} aria-label="Regions">
      <button
        className="panel-toggle"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span className="panel-toggle-label">REGIONS</span>
        <span className="panel-toggle-meta">{REGIONS.length}</span>
        <svg viewBox="0 0 12 8" aria-hidden="true" className="panel-caret">
          <path
            d="M1 2 6 7 11 2"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {open && (
        <div className="region-body">
          {REGIONS.map((r) => {
            const members = projects.filter(r.match);
            const shown = members.filter((p) => visibleIds.has(p.id)).length;
            return (
              <button
                key={r.id}
                className="region-row"
                onClick={() => {
                  onFly(r.bounds);
                  setOpen(false);
                }}
              >
                <span className="region-info">
                  <span className="region-label">{r.label}</span>
                  <span className="region-sub">{r.sub}</span>
                </span>
                <span className="region-count">{shown}</span>
              </button>
            );
          })}
        </div>
      )}
    </nav>
  );
}

/** Memoized: only re-renders when its own props actually change. */
export const RegionNav = memo(RegionNavBase);
