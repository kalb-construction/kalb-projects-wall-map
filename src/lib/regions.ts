import type { Project } from '../types';

export type BBox = [[number, number], [number, number]]; // [[w,s],[e,n]]

export interface RegionDef {
  id: string;
  label: string;
  sub: string;
  /** Which projects belong to this quick-nav region. */
  match: (p: Project) => boolean;
  bounds: BBox;
}

export const REGIONS: RegionDef[] = [
  {
    id: 'lv',
    label: 'Las Vegas Valley',
    sub: 'Las Vegas · North LV · Henderson',
    match: (p) => p.region === 'LV',
    bounds: [
      [-115.345, 35.985],
      [-114.935, 36.315]
    ]
  },
  {
    id: 'nnv',
    label: 'Northern Nevada',
    sub: 'Reno · Sparks · Carson City',
    match: (p) => p.region === 'NNV',
    bounds: [
      [-119.86, 39.09],
      [-119.45, 39.6]
    ]
  },
  {
    id: 'az',
    label: 'Arizona',
    sub: 'Gilbert · Avondale · Phoenix',
    match: (p) => p.region === 'AZ',
    bounds: [
      [-112.4, 33.19],
      [-111.6, 33.58]
    ]
  }
];

/** Bounding box of a set of projects, padded slightly. */
export function boundsOf(projects: Project[]): BBox | null {
  if (projects.length === 0) return null;
  let w = Infinity,
    s = Infinity,
    e = -Infinity,
    n = -Infinity;
  for (const p of projects) {
    w = Math.min(w, p.lng);
    e = Math.max(e, p.lng);
    s = Math.min(s, p.lat);
    n = Math.max(n, p.lat);
  }
  const padX = Math.max(0.01, (e - w) * 0.15);
  const padY = Math.max(0.01, (n - s) * 0.15);
  return [
    [w - padX, s - padY],
    [e + padX, n + padY]
  ];
}
