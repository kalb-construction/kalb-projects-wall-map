/**
 * Stylized-map projection for the Las Vegas valley.
 *
 * The atlas is not a GIS — it's a branded, hand-tuned vector map. We use a
 * simple equirectangular projection over a fixed bounding box, with the
 * world height chosen so the aspect ratio approximates the true
 * cos(latitude) correction for ~36°N. Coordinates in projects.json are
 * approximate; nudging a marker means editing lat/lng there.
 */

export const LV_BOUNDS = {
  lonMin: -115.38,
  lonMax: -114.9,
  latMin: 35.96,
  latMax: 36.335
};

/** World (SVG) space dimensions for the Las Vegas surface. */
export const WORLD_W = 1200;
export const WORLD_H = Math.round(
  (WORLD_W * (LV_BOUNDS.latMax - LV_BOUNDS.latMin)) /
    ((LV_BOUNDS.lonMax - LV_BOUNDS.lonMin) * Math.cos((36.15 * Math.PI) / 180))
);

export interface WorldPoint {
  x: number;
  y: number;
}

export function project(lng: number, lat: number): WorldPoint {
  const x =
    ((lng - LV_BOUNDS.lonMin) / (LV_BOUNDS.lonMax - LV_BOUNDS.lonMin)) *
    WORLD_W;
  const y =
    ((LV_BOUNDS.latMax - lat) / (LV_BOUNDS.latMax - LV_BOUNDS.latMin)) *
    WORLD_H;
  return { x, y };
}

/** Shorthand used by the basemap path builders. */
export function p(lat: number, lng: number): string {
  const { x, y } = project(lng, lat);
  return `${x.toFixed(1)},${y.toFixed(1)}`;
}

export function polyline(points: Array<[number, number]>): string {
  return 'M' + points.map(([lat, lng]) => p(lat, lng)).join(' L');
}

export const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export const clamp = (v: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, v));
