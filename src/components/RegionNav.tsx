import type { Project } from '../types';
import { REGIONS, type BBox } from '../lib/regions';

interface RegionNavProps {
  projects: Project[];
  visibleIds: Set<string>;
  onFly: (bounds: BBox) => void;
}

/**
 * Quick-nav card: one tap flies the camera to each Kalb region
 * (Las Vegas Valley, Northern Nevada, Arizona).
 */
export function RegionNav({ projects, visibleIds, onFly }: RegionNavProps) {
  return (
    <nav className="region-nav" aria-label="Regions">
      <div className="region-nav-head">REGIONS</div>
      {REGIONS.map((r) => {
        const members = projects.filter(r.match);
        const shown = members.filter((p) => visibleIds.has(p.id)).length;
        return (
          <button key={r.id} className="region-row" onClick={() => onFly(r.bounds)}>
            <span className="region-info">
              <span className="region-label">{r.label}</span>
              <span className="region-sub">{r.sub}</span>
            </span>
            <span className="region-count">{shown}</span>
          </button>
        );
      })}
    </nav>
  );
}
