import type { Project } from '../types';

/**
 * The unattended camera tour: what it visits, and in what order.
 *
 * Left alone, the wall flies itself from job to job, opening each project
 * so its photographs play. The route matters — picking the next stop at
 * random ricochets the camera between Henderson and Summerlin and reads as
 * a glitch. A nearest-neighbour chain makes short hops, so the tour looks
 * like someone driving the valley rather than a slideshow that happens to
 * move a map.
 */

/** Squared degree distance. Fine for one metro area; no trig needed. */
function gap(a: Project, b: Project): number {
  const dx = a.lng - b.lng;
  const dy = a.lat - b.lat;
  return dx * dx + dy * dy;
}

/**
 * Orders projects into a route that travels well.
 *
 * Only projects with photographs are toured — the whole point is the
 * pictures, and a stop that opens an empty card is a dead beat on the
 * wall. If too few have photos to make a tour, the caller gets nothing
 * back and the wall just waits for the screensaver instead.
 */
export function tourRoute(projects: Project[]): Project[] {
  const pool = projects.filter(
    (p) =>
      p.photos &&
      p.photos.length > 0 &&
      Number.isFinite(p.lat) &&
      Number.isFinite(p.lng)
  );
  if (pool.length < 3) return [];

  // Start at the western edge so the first few hops read left-to-right,
  // the way the valley sits on the wall.
  const remaining = [...pool].sort((a, b) => a.lng - b.lng);
  const route: Project[] = [remaining.shift()!];

  while (remaining.length > 0) {
    const last = route[route.length - 1];
    let best = 0;
    let bestGap = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = gap(last, remaining[i]);
      if (d < bestGap) {
        bestGap = d;
        best = i;
      }
    }
    route.push(remaining.splice(best, 1)[0]);
  }
  return route;
}

/**
 * Slow out of the last stop, slow into the next one. Mapbox's default
 * easing is already eased, but a longer, softer curve is the difference
 * between a camera move and a jump cut.
 */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * How long a tour flight should take, given how far it travels.
 *
 * The portfolio runs from Carson City to Phoenix, so one hop can be four
 * hundred miles and the next two hundred yards. A single fixed duration
 * serves neither: it makes the long haul a dizzying blur and the short
 * step an interminable creep. This scales with distance and clamps at both
 * ends, so every hop lands somewhere between brisk and stately.
 *
 * The ceiling matters as much as the curve — the tour dwells on each stop
 * for a fixed span, and a flight that overruns it eats the photographs it
 * flew there to show.
 */
export function tourFlightMs(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): number {
  // Longitude degrees shrink toward the poles; correcting keeps a
  // north-south hop from being over-weighted against an east-west one.
  const dx = (to.lng - from.lng) * Math.cos((to.lat * Math.PI) / 180);
  const dy = to.lat - from.lat;
  const degrees = Math.hypot(dx, dy);
  return Math.min(7600, 3400 + degrees * 900);
}
