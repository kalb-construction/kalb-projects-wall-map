import { useState } from 'react';
import type { Project } from '../types';
import { statusTone } from '../lib/meta';

/**
 * Side panels for projects outside the Las Vegas valley surface:
 * Northern Nevada (Sparks / Carson City / Dayton) and Arizona (Gilbert).
 * Mini-map dot positions are hand-placed per panel.
 */

interface InsetPanelsProps {
  projects: Project[];
  visibleIds: Set<string>;
  selectedId: string | null;
  onSelect: (p: Project) => void;
}

const NNV_POS: Record<string, { x: number; y: number }> = {
  '26701': { x: 150, y: 34 }, // Sparks
  'lcb-carson': { x: 52, y: 96 }, // Carson City cluster
  '26705': { x: 168, y: 84 } // Dayton
};

export function InsetPanels({
  projects,
  visibleIds,
  selectedId,
  onSelect
}: InsetPanelsProps) {
  const [openCluster, setOpenCluster] = useState(false);
  const nnv = projects.filter((p) => p.region === 'NNV');
  const az = projects.filter((p) => p.region === 'AZ');
  const lcb = nnv.filter((p) => p.siteId === 'lcb-carson');
  const nnvSingles = nnv.filter((p) => !p.siteId);

  const dotClass = (p: Project) =>
    `inset-dot tone-${statusTone(p.status)}${
      visibleIds.has(p.id) ? '' : ' is-dim'
    }${selectedId === p.id ? ' is-selected' : ''}`;

  return (
    <div className="insets">
      <section className="inset-card" aria-label="Northern Nevada projects">
        <header className="inset-head">
          <span className="inset-title">NORTHERN NEVADA</span>
          <span className="inset-count">{nnv.length}</span>
        </header>
        <svg viewBox="0 0 216 132" className="inset-map">
          {/* I-80 */}
          <path className="inset-road" d="M4,36 C60,30 120,38 212,30" />
          {/* US-395 / I-580 */}
          <path className="inset-road" d="M132,34 C100,52 62,70 50,128" />
          {/* US-50 to Dayton */}
          <path className="inset-road inset-road-minor" d="M54,100 C90,92 130,90 170,84" />
          <text className="inset-geo" x="10" y="24">RENO · SPARKS</text>
          <text className="inset-geo" x="14" y="122">CARSON CITY</text>
          <text className="inset-geo" x="146" y="104">DAYTON</text>

          {nnvSingles.map((p) => {
            const pos = NNV_POS[p.id];
            if (!pos) return null;
            return (
              <g
                key={p.id}
                transform={`translate(${pos.x},${pos.y})`}
                className={dotClass(p)}
                onClick={() => visibleIds.has(p.id) && onSelect(p)}
                role="button"
                aria-label={`${p.number} ${p.name}`}
              >
                <circle className="inset-dot-halo" r="11" />
                <circle className="inset-dot-core" r="5.5" />
              </g>
            );
          })}

          <g
            transform={`translate(${NNV_POS['lcb-carson'].x},${NNV_POS['lcb-carson'].y})`}
            className={`inset-dot inset-cluster${openCluster ? ' is-open' : ''}`}
            onClick={() => setOpenCluster(!openCluster)}
            role="button"
            aria-label={`Carson City, ${lcb.length} projects`}
          >
            <circle className="inset-dot-halo" r="14" />
            <circle className="inset-dot-core" r="9" />
            <text className="inset-cluster-count" y="3.5">
              {lcb.length}
            </text>
          </g>
        </svg>

        {openCluster && (
          <div className="inset-list">
            {lcb.map((p) => (
              <button
                key={p.id}
                className={`inset-row${selectedId === p.id ? ' is-active' : ''}${
                  visibleIds.has(p.id) ? '' : ' is-dim'
                }`}
                onClick={() => {
                  if (visibleIds.has(p.id)) {
                    onSelect(p);
                    setOpenCluster(false);
                  }
                }}
              >
                <span className="sr-number">{p.number}</span>
                <span className="inset-row-name">{p.shortName ?? p.name}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="inset-card inset-card-az" aria-label="Arizona projects">
        <header className="inset-head">
          <span className="inset-title">ARIZONA</span>
          <span className="inset-count">{az.length}</span>
        </header>
        <svg viewBox="0 0 216 84" className="inset-map">
          <path className="inset-road" d="M4,40 C70,48 150,42 212,52" />
          <path className="inset-road inset-road-minor" d="M150,8 L146,78" />
          <text className="inset-geo" x="10" y="26">PHOENIX METRO</text>
          <text className="inset-geo" x="132" y="74">GILBERT</text>
          {az.map((p) => (
            <g
              key={p.id}
              transform="translate(146,46)"
              className={dotClass(p)}
              onClick={() => visibleIds.has(p.id) && onSelect(p)}
              role="button"
              aria-label={`${p.number} ${p.name}`}
            >
              <circle className="inset-dot-halo" r="11" />
              <circle className="inset-dot-core" r="5.5" />
            </g>
          ))}
        </svg>
      </section>
    </div>
  );
}
