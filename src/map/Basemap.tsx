import { memo } from 'react';
import { polyline, project, WORLD_H, WORLD_W } from '../lib/geo';

/**
 * Hand-tuned, brand-styled vector basemap of the Las Vegas valley.
 * Geometry is approximate by design — this is an atlas graphic, not GIS.
 * Freeways and arterials are placed from real coordinates so project
 * markers land where a local expects them.
 */

const FWY_I15: Array<[number, number]> = [
  [35.962, -115.194],
  [36.05, -115.182],
  [36.1, -115.175],
  [36.145, -115.157],
  [36.176, -115.15],
  [36.2, -115.14],
  [36.24, -115.125],
  [36.27, -115.1],
  [36.3, -115.04],
  [36.33, -114.96]
];

const FWY_US95_W: Array<[number, number]> = [
  [36.334, -115.33],
  [36.27, -115.288],
  [36.238, -115.267],
  [36.21, -115.225],
  [36.192, -115.185],
  [36.176, -115.152]
];

const FWY_US95_E: Array<[number, number]> = [
  [36.176, -115.152],
  [36.163, -115.115],
  [36.16, -115.08],
  [36.14, -115.055],
  [36.1, -115.04],
  [36.06, -115.005],
  [36.032, -114.978],
  [35.998, -114.935]
];

const FWY_215: Array<[number, number]> = [
  [36.3, -115.29],
  [36.22, -115.306],
  [36.14, -115.312],
  [36.07, -115.305],
  [36.052, -115.27],
  [36.048, -115.2],
  [36.06, -115.155],
  [36.062, -115.12],
  [36.052, -115.08],
  [36.035, -115.042],
  [36.032, -114.99]
];

const FWY_215N: Array<[number, number]> = [
  [36.3, -115.29],
  [36.29, -115.24],
  [36.272, -115.17],
  [36.268, -115.125],
  [36.27, -115.1]
];

/** Arterial grid: [lat, lngFrom, lngTo] horizontals. */
const H_ROADS: Array<[number, number, number]> = [
  [36.2483, -115.31, -115.06], // Ann
  [36.2395, -115.31, -115.05], // Craig
  [36.2189, -115.3, -115.06], // Cheyenne
  [36.1965, -115.28, -115.06], // Lake Mead
  [36.1585, -115.34, -115.06], // Charleston
  [36.1447, -115.34, -115.08], // Sahara
  [36.1297, -115.32, -115.1], // Desert Inn
  [36.1152, -115.32, -115.08], // Flamingo
  [36.0997, -115.32, -115.05], // Tropicana
  [36.085, -115.32, -115.08], // Russell
  [36.0705, -115.31, -115.05], // Sunset
  [36.056, -115.28, -115.09] // Warm Springs
];

/** Arterial grid: [lng, latFrom, latTo] verticals. */
const V_ROADS: Array<[number, number, number]> = [
  [-115.2825, 36.05, 36.29], // Durango
  [-115.2605, 36.05, 36.27], // Buffalo
  [-115.243, 36.05, 36.29], // Rainbow
  [-115.2245, 36.06, 36.28], // Jones
  [-115.2065, 36.05, 36.27], // Decatur
  [-115.1885, 36.06, 36.25], // Valley View
  [-115.1195, 36.04, 36.3], // Eastern / Civic Center
  [-115.1, 36.05, 36.29], // Pecos
  [-115.0805, 36.06, 36.28], // Lamb
  [-115.0625, 36.08, 36.26] // Nellis
];

const BOULDER_HWY: Array<[number, number]> = [
  [36.155, -115.122],
  [36.12, -115.08],
  [36.075, -115.02],
  [36.04, -114.982],
  [36.005, -114.95]
];

const LV_BLVD: Array<[number, number]> = [
  [36.2, -115.146],
  [36.17, -115.144],
  [36.145, -115.156],
  [36.11, -115.172],
  [36.08, -115.175],
  [36.04, -115.183]
];

export const MAP_LABELS: Array<{
  lat: number;
  lng: number;
  text: string;
  size?: number;
}> = [
  { lat: 36.243, lng: -115.185, text: 'NORTH LAS VEGAS', size: 15 },
  { lat: 36.168, lng: -115.139, text: 'DOWNTOWN', size: 11 },
  { lat: 36.17, lng: -115.315, text: 'SUMMERLIN', size: 13 },
  { lat: 36.098, lng: -115.168, text: 'THE STRIP', size: 10 },
  { lat: 36.017, lng: -115.015, text: 'HENDERSON', size: 15 },
  { lat: 36.077, lng: -115.27, text: 'SOUTHWEST', size: 11 },
  { lat: 36.31, lng: -115.005, text: 'APEX', size: 10 },
  { lat: 36.0785, lng: -115.152, text: 'HARRY REID INTL', size: 8.5 }
];

/**
 * District labels render outside the memoized basemap so they can
 * partially counter-scale with zoom (big at home, restrained up close).
 */
export function BasemapLabels({ scale }: { scale: number }) {
  const labelK = Math.min(1.7, Math.max(0.42, 1 / Math.sqrt(scale)));
  return (
    <g>
      {MAP_LABELS.map((l, i) => {
        const pt = project(l.lng, l.lat);
        return (
          <text
            key={i}
            className="bm-label"
            fontSize={l.size ?? 12}
            textAnchor="middle"
            transform={`translate(${pt.x},${pt.y}) scale(${labelK})`}
          >
            {l.text}
          </text>
        );
      })}
    </g>
  );
}

/** Decorative mountain ridgelines framing the valley. */
const RIDGES: Array<Array<[number, number]>> = [
  [
    [36.32, -115.365],
    [36.25, -115.355],
    [36.17, -115.365],
    [36.08, -115.36],
    [35.99, -115.34]
  ],
  [
    [36.3, -115.375],
    [36.2, -115.372],
    [36.1, -115.375]
  ],
  [
    [36.33, -115.3],
    [36.325, -115.2],
    [36.318, -115.1]
  ],
  [
    [36.12, -114.925],
    [36.2, -114.93],
    [36.29, -114.94]
  ],
  [
    [35.985, -115.28],
    [35.975, -115.18],
    [35.968, -115.05]
  ]
];

function AirportGlyph() {
  const a = project(-115.152, 36.086);
  return (
    <g opacity={0.35}>
      <rect
        x={a.x - 14}
        y={a.y - 8}
        width={30}
        height={18}
        rx={2}
        fill="none"
        stroke="var(--map-line)"
        strokeWidth={0.8}
        vectorEffect="non-scaling-stroke"
        transform={`rotate(-14 ${a.x} ${a.y})`}
      />
    </g>
  );
}

export const Basemap = memo(function Basemap() {
  return (
    <g>
      {/* valley floor wash */}
      <rect x={0} y={0} width={WORLD_W} height={WORLD_H} fill="url(#valleyFloor)" />

      {/* mountain ridges */}
      {RIDGES.map((r, i) => (
        <path
          key={i}
          d={polyline(r)}
          fill="none"
          stroke="var(--map-ridge)"
          strokeWidth={22 - i * 3}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.5}
        />
      ))}

      {/* arterial grid — subtle, non-scaling strokes */}
      <g className="bm-arterials">
        {H_ROADS.map(([lat, from, to], i) => (
          <path
            key={`h${i}`}
            d={polyline([
              [lat, from],
              [lat, to]
            ])}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {V_ROADS.map(([lng, from, to], i) => (
          <path
            key={`v${i}`}
            d={polyline([
              [from, lng],
              [to, lng]
            ])}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <path d={polyline(BOULDER_HWY)} vectorEffect="non-scaling-stroke" />
        <path
          d={polyline(LV_BLVD)}
          vectorEffect="non-scaling-stroke"
          className="bm-strip"
        />
      </g>

      {/* freeways — glow underlay + core line */}
      <g className="bm-freeways">
        {[FWY_I15, FWY_US95_W, FWY_US95_E, FWY_215, FWY_215N].map((f, i) => (
          <path
            key={`glow${i}`}
            d={polyline(f)}
            className="bm-fwy-glow"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {[FWY_I15, FWY_US95_W, FWY_US95_E, FWY_215, FWY_215N].map((f, i) => (
          <path
            key={`core${i}`}
            d={polyline(f)}
            className="bm-fwy"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </g>

      <AirportGlyph />
    </g>
  );
});
