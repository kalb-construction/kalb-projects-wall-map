import { memo, useMemo } from 'react';
import type { Project } from '../types';
import { project } from '../lib/geo';
import { statusTone } from '../lib/meta';

interface MarkerLayerProps {
  projects: Project[];
  /** Current total screen scale — markers render at 1/scale for constant px size. */
  scale: number;
  visibleIds: Set<string>;
  selectedId: string | null;
  expandedSite: string | null;
  onExpandSite: (siteId: string | null) => void;
  onSelect: (p: Project) => void;
  onHover: (id: string | null) => void;
}

interface SiteGroup {
  siteId: string;
  siteName: string;
  x: number;
  y: number;
  members: Project[];
}

function PinHead({
  r,
  tone,
  featured,
  selected
}: {
  r: number;
  tone: 'active' | 'precon' | 'done';
  featured: boolean;
  selected: boolean;
}) {
  return (
    <g className={`pin-head tone-${tone}${selected ? ' is-selected' : ''}`}>
      {(featured || selected) && (
        <circle className="pin-pulse" cy={-r - 5} r={r + 7} />
      )}
      <path
        className="pin-stem"
        d={`M0,7 L${-r * 0.55},${-r * 0.4} L${r * 0.55},${-r * 0.4} Z`}
      />
      <circle className="pin-circle" cy={-r - 5} r={r} />
      <text className="pin-k" y={-r - 5}>
        K
      </text>
    </g>
  );
}

function MarkerLabel({
  text,
  y,
  emphasized
}: {
  text: string;
  y: number;
  emphasized: boolean;
}) {
  const w = text.length * 6.4 + 18;
  return (
    <g className={`pin-label${emphasized ? ' is-on' : ''}`}>
      <rect x={-w / 2} y={y} width={w} height={19} rx={9.5} />
      <text y={y + 13}>{text}</text>
    </g>
  );
}

export const MarkerLayer = memo(function MarkerLayer({
  projects,
  scale,
  visibleIds,
  selectedId,
  expandedSite,
  onExpandSite,
  onSelect,
  onHover
}: MarkerLayerProps) {
  const { singles, sites } = useMemo(() => {
    const singles: Project[] = [];
    const siteMap = new Map<string, SiteGroup>();
    for (const p of projects) {
      if (!p.siteId) {
        singles.push(p);
        continue;
      }
      let g = siteMap.get(p.siteId);
      if (!g) {
        const pt = project(p.lng, p.lat);
        g = {
          siteId: p.siteId,
          siteName: p.siteName ?? p.name,
          x: pt.x,
          y: pt.y,
          members: []
        };
        siteMap.set(p.siteId, g);
      }
      g.members.push(p);
    }
    return { singles, sites: [...siteMap.values()] };
  }, [projects]);

  const inv = 1 / scale;
  const labelsOn = scale > 2.1;

  return (
    <g>
      {singles.map((p) => {
        const pt = project(p.lng, p.lat);
        const dim = !visibleIds.has(p.id);
        const selected = selectedId === p.id;
        return (
          <g
            key={p.id}
            className={`marker${dim ? ' is-dim' : ''}`}
            transform={`translate(${pt.x},${pt.y}) scale(${inv})`}
            onClick={(e) => {
              e.stopPropagation();
              if (!dim) onSelect(p);
            }}
            onPointerEnter={(e) => {
              if (e.pointerType === 'mouse' && !dim) onHover(p.id);
            }}
            onPointerLeave={() => onHover(null)}
            role="button"
            aria-label={`${p.number} ${p.name}`}
          >
            <ellipse className="pin-shadow" cy={8} rx={9} ry={3.2} />
            <PinHead
              r={10}
              tone={statusTone(p.status)}
              featured={p.featured}
              selected={selected}
            />
            <MarkerLabel
              text={`${p.number} · ${p.shortName ?? p.name}`}
              y={14}
              emphasized={labelsOn || selected}
            />
          </g>
        );
      })}

      {sites.map((site) => {
        const isOpen = expandedSite === site.siteId;
        const visCount = site.members.filter((m) => visibleIds.has(m.id)).length;
        const anyVisible = visCount > 0;
        const fanR = 112;
        return (
          <g
            key={site.siteId}
            className={`marker site${anyVisible ? '' : ' is-dim'}`}
            transform={`translate(${site.x},${site.y}) scale(${inv})`}
          >
            {isOpen && (
              <g className="site-fan">
                <circle className="site-ring" r={fanR} />
                {site.members.map((m, i) => {
                  const a =
                    -Math.PI / 2 + (i / site.members.length) * Math.PI * 2;
                  const fx = Math.cos(a) * fanR;
                  const fy = Math.sin(a) * fanR;
                  const dim = !visibleIds.has(m.id);
                  return (
                    <g key={m.id} className={dim ? 'is-dim' : ''}>
                      <line className="site-spoke" x2={fx} y2={fy} />
                      <g
                        className="site-child"
                        transform={`translate(${fx},${fy})`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!dim) onSelect(m);
                        }}
                        onPointerEnter={(e) => {
                          if (e.pointerType === 'mouse' && !dim) onHover(m.id);
                        }}
                        onPointerLeave={() => onHover(null)}
                        role="button"
                        aria-label={`${m.number} ${m.name}`}
                      >
                        <PinHead
                          r={8}
                          tone={statusTone(m.status)}
                          featured={false}
                          selected={selectedId === m.id}
                        />
                        <MarkerLabel
                          text={`${m.number} · ${m.shortName ?? m.name}`}
                          y={fy < -8 ? -42 : 10}
                          emphasized
                        />
                      </g>
                    </g>
                  );
                })}
              </g>
            )}

            <g
              className="site-hub"
              onClick={(e) => {
                e.stopPropagation();
                onExpandSite(isOpen ? null : site.siteId);
              }}
              onPointerEnter={() => onHover(null)}
              role="button"
              aria-label={`${site.siteName}, ${site.members.length} projects`}
            >
              <ellipse className="pin-shadow" cy={9} rx={12} ry={4} />
              <circle className="site-halo" r={22} />
              <circle className="site-core" r={14} />
              <text className="site-count" y={0.5}>
                {visCount}
              </text>
              <MarkerLabel
                text={site.siteName.toUpperCase()}
                y={20}
                emphasized={labelsOn || isOpen}
              />
            </g>
          </g>
        );
      })}
    </g>
  );
});
