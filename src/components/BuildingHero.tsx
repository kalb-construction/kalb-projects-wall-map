import { memo, useMemo } from 'react';
import type { Category, Project } from '../types';
import { seededRandom } from '../lib/rng';

/**
 * Procedural isometric building scene, seeded by project number so every
 * project has a stable, distinct "render" until a real architectural image
 * is provided via `heroImage`. Palette is strictly Kalb brand: sand walls,
 * concrete shadow faces, Kalb-red accents on ink.
 */

const ISO_X = 0.866;
const ISO_Y = 0.5;

interface Block {
  x: number;
  y: number;
  w: number;
  d: number;
  h: number;
  accent?: boolean;
  glassy?: boolean;
  ribbed?: boolean;
  pylon?: boolean;
}

function iso(x: number, y: number, z: number, s: number): [number, number] {
  return [(x - y) * ISO_X * s, (x + y) * ISO_Y * s - z * s];
}

function facePath(pts: Array<[number, number]>): string {
  return 'M' + pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join('L') + 'Z';
}

/** Massing recipes per category — [count, footprint bias, height bias]. */
function massing(category: Category, rnd: () => number): Block[] {
  const blocks: Block[] = [];
  const push = (b: Block) => blocks.push(b);
  switch (category) {
    case 'Restaurant':
    case 'Tavern & Gaming':
      push({ x: 0, y: 0, w: 34, d: 24, h: 12 + rnd() * 3, accent: true });
      push({ x: 6, y: -8, w: 12, d: 6, h: 8 });
      push({ x: 38, y: 4, w: 4, d: 4, h: 26, pylon: true });
      break;
    case 'Retail':
      push({ x: 0, y: 0, w: 52, d: 22, h: 13, accent: true });
      push({ x: 8, y: -3, w: 14, d: 4, h: 16 });
      push({ x: 34, y: -3, w: 10, d: 4, h: 15 });
      break;
    case 'Office & TI':
    case 'Medical':
      push({ x: 0, y: 0, w: 30, d: 26, h: 20 + rnd() * 8, glassy: true });
      push({ x: 24, y: 6, w: 20, d: 18, h: 13 + rnd() * 5, glassy: true, accent: true });
      break;
    case 'Industrial':
      push({ x: 0, y: 0, w: 56, d: 30, h: 18, ribbed: true, accent: true });
      push({ x: 46, y: 8, w: 14, d: 12, h: 9 });
      break;
    case 'Civic & Housing':
      push({ x: 0, y: 0, w: 26, d: 22, h: 17, accent: true });
      push({ x: 22, y: 2, w: 26, d: 20, h: 23, glassy: true });
      break;
    case 'Automotive & Storage':
      push({ x: 0, y: 0, w: 20, d: 26, h: 12 });
      push({ x: 20, y: 0, w: 20, d: 26, h: 12, accent: true });
      push({ x: 40, y: 0, w: 20, d: 26, h: 12 });
      break;
    case 'Recreation & Events':
      push({ x: 0, y: 0, w: 42, d: 30, h: 16, accent: true });
      push({ x: 8, y: 6, w: 26, d: 18, h: 22, glassy: true });
      break;
    case 'Design-Build':
      push({ x: 0, y: 0, w: 36, d: 26, h: 15, glassy: true, accent: true });
      break;
    default:
      push({ x: 0, y: 0, w: 36, d: 24, h: 14, accent: true });
  }
  return blocks;
}

interface BuildingHeroProps {
  project: Project;
  /** compact renders fewer flourishes (rail cards / attract cycles). */
  compact?: boolean;
}

export const BuildingHero = memo(function BuildingHero({
  project,
  compact = false
}: BuildingHeroProps) {
  const scene = useMemo(() => {
    const rnd = seededRandom(project.number);
    const blocks = massing(project.category, rnd).sort(
      (a, b) => a.x + a.y - (b.x + b.y)
    );
    return { rnd, blocks };
  }, [project]);

  if (project.heroImage) {
    return (
      <div className="hero-frame">
        <img
          className="hero-img"
          src={project.heroImage}
          alt={`${project.name} architectural render`}
        />
      </div>
    );
  }

  const S = 5.2;
  const originX = 320;
  const originY = compact ? 240 : 268;
  const showCrane = project.status === 'Preconstruction';
  const solar = project.tags?.includes('solar');

  const groundLines: string[] = [];
  for (let i = -6; i <= 12; i++) {
    const [x1, y1] = iso(i * 10, -40, 0, S);
    const [x2, y2] = iso(i * 10, 80, 0, S);
    groundLines.push(`M${x1},${y1}L${x2},${y2}`);
    const [x3, y3] = iso(-40, i * 10, 0, S);
    const [x4, y4] = iso(120, i * 10, 0, S);
    groundLines.push(`M${x3},${y3}L${x4},${y4}`);
  }

  return (
    <div className="hero-frame">
      <svg
        className="hero-svg"
        viewBox="0 0 640 400"
        role="img"
        aria-label={`Stylized building visual for ${project.name}`}
      >
        <defs>
          <radialGradient id={`rim-${project.id}`} cx="30%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#c10016" stopOpacity="0.28" />
            <stop offset="60%" stopColor="#c10016" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#c10016" stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect width="640" height="400" fill={`url(#rim-${project.id})`} />

        <g transform={`translate(${originX},${originY})`}>
          {/* ground grid */}
          <g className="hero-grid">
            {groundLines.map((d, i) => (
              <path key={i} d={d} />
            ))}
          </g>

          {/* drop shadow pad */}
          <path
            className="hero-pad"
            d={facePath([
              iso(-14, -14, 0, S),
              iso(86, -14, 0, S),
              iso(86, 66, 0, S),
              iso(-14, 66, 0, S)
            ])}
          />

          {scene.blocks.map((b, bi) => {
            const { x, y, w, d, h } = b;
            const top = facePath([
              iso(x, y, h, S),
              iso(x + w, y, h, S),
              iso(x + w, y + d, h, S),
              iso(x, y + d, h, S)
            ]);
            const left = facePath([
              iso(x, y + d, h, S),
              iso(x + w, y + d, h, S),
              iso(x + w, y + d, 0, S),
              iso(x, y + d, 0, S)
            ]);
            const right = facePath([
              iso(x + w, y, h, S),
              iso(x + w, y + d, h, S),
              iso(x + w, y + d, 0, S),
              iso(x + w, y, 0, S)
            ]);

            const windowsLeft: JSX.Element[] = [];
            if (b.glassy) {
              const rows = Math.max(1, Math.floor(h / 6));
              for (let r = 0; r < rows; r++) {
                const z1 = h - 2.4 - r * 6;
                if (z1 - 2.6 < 1) break;
                windowsLeft.push(
                  <path
                    key={`wl${r}`}
                    className="hero-glass"
                    d={facePath([
                      iso(x + 1.5, y + d, z1, S),
                      iso(x + w - 1.5, y + d, z1, S),
                      iso(x + w - 1.5, y + d, z1 - 2.6, S),
                      iso(x + 1.5, y + d, z1 - 2.6, S)
                    ])}
                  />
                );
              }
            }
            if (b.ribbed) {
              for (let rx = x + 4; rx < x + w - 2; rx += 5) {
                windowsLeft.push(
                  <path
                    key={`rib${rx}`}
                    className="hero-rib"
                    d={facePath([
                      iso(rx, y + d, h - 1.5, S),
                      iso(rx + 2.2, y + d, h - 1.5, S),
                      iso(rx + 2.2, y + d, 1.5, S),
                      iso(rx, y + d, 1.5, S)
                    ])}
                  />
                );
              }
            }

            return (
              <g key={bi} className={b.pylon ? 'hero-pylon' : ''}>
                <path className="hero-face-left" d={left} />
                <path className="hero-face-right" d={right} />
                <path
                  className={`hero-face-top${solar && bi === 0 ? ' hero-solar' : ''}`}
                  d={top}
                />
                {windowsLeft}
                {b.accent && (
                  <path
                    className="hero-accent"
                    d={facePath([
                      iso(x, y + d, h, S),
                      iso(x + w, y + d, h, S),
                      iso(x + w, y + d, h - 1.8, S),
                      iso(x, y + d, h - 1.8, S)
                    ])}
                  />
                )}
                {b.pylon && (
                  <path
                    className="hero-sign"
                    d={facePath([
                      iso(x - 1, y + d + 1, h - 2, S),
                      iso(x + w + 1, y + d + 1, h - 2, S),
                      iso(x + w + 1, y + d + 1, h - 9, S),
                      iso(x - 1, y + d + 1, h - 9, S)
                    ])}
                  />
                )}
              </g>
            );
          })}

          {/* entry marker pin */}
          <g transform={`translate(${iso(-8, 58, 0, S)[0]},${iso(-8, 58, 0, S)[1]})`}>
            <circle className="hero-pin" r="4.5" cy="-10" />
            <path className="hero-pin" d="M0,0 L-3,-8 L3,-8 Z" />
          </g>

          {showCrane && !compact && (
            <g className="hero-crane" transform="translate(-150,-10)">
              <path d="M0,0 L0,-150 M-12,0 L12,0 M0,-150 L118,-150 M0,-150 L-34,-150 M0,-128 L96,-150 M96,-150 L96,-118 M-34,-150 L-34,-138" />
              <rect x="90" y="-118" width="12" height="10" />
            </g>
          )}
        </g>
      </svg>
    </div>
  );
});
