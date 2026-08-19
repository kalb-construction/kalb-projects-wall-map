import type { Project } from '../types';

/**
 * Runtime guard for data/projects.json.
 *
 * The file is fetched at runtime and handed straight to the renderer, so a
 * single bad row used to be able to take down the entire lobby wall — there
 * is no server-side schema check and one throw during render blanks the
 * screen. Two real crash paths existed:
 *
 *   - `number` missing  → seededRandom(undefined) reads `.length` → TypeError
 *                         inside BuildingHero, which renders in both the
 *                         detail card and the attract loop.
 *   - `name` AND `shortName` missing → ProjectIndex sorts with
 *                         undefined.localeCompare() → TypeError.
 *
 * A wall that shows 200 of 201 projects is a data problem. A wall showing
 * nothing is an outage. So: drop the unusable rows, keep the rest, and say
 * loudly in the console which ones went and why.
 */

export interface ValidationResult {
  projects: Project[];
  dropped: Array<{ index: number; id: string; reason: string }>;
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/** Reasons a row cannot be rendered at all. Anything else is tolerated. */
function fatalReason(p: Partial<Project>): string | null {
  if (typeof p.id !== 'string' || p.id.trim() === '') return 'missing id';
  if (typeof p.number !== 'string' || p.number === '')
    return 'missing/non-string number (crashes the procedural hero)';
  if (typeof p.name !== 'string' || p.name === '')
    return 'missing name (crashes the index sort)';
  // City and state are read straight into localeCompare and into the
  // "N cities" grouping key, so a non-string is the same class of crash
  // as a missing name.
  if (typeof p.city !== 'string' || p.city === '') return 'missing city';
  if (typeof p.state !== 'string' || p.state === '') return 'missing state';
  if (!isFiniteNumber(p.lat) || !isFiniteNumber(p.lng))
    return 'missing or non-numeric lat/lng';
  if (p.lat < -90 || p.lat > 90) return `latitude out of range (${p.lat})`;
  if (p.lng < -180 || p.lng > 180) return `longitude out of range (${p.lng})`;
  // `photos` is spread into the slider and indexed; a bare string would be
  // iterated character by character and a number would throw outright.
  if (p.photos !== undefined && !Array.isArray(p.photos))
    return 'photos is present but not an array';
  return null;
}

/**
 * Thrown when the file is structurally unusable, as opposed to containing
 * some bad rows. An empty atlas is indistinguishable on screen from "Kalb
 * has no projects", which is a lie; the boot screen's retry loop and the
 * error boundary are both better outcomes than a confidently empty wall.
 */
export class ProjectDataError extends Error {}

export function validateProjects(raw: unknown): ValidationResult {
  const dropped: ValidationResult['dropped'] = [];
  if (!Array.isArray(raw)) {
    throw new ProjectDataError(
      'data/projects.json is not a JSON array — the whole file is unusable.'
    );
  }

  const seen = new Set<string>();
  const projects: Project[] = [];

  raw.forEach((row, index) => {
    const p = row as Partial<Project>;
    const reason = fatalReason(p);
    if (reason) {
      dropped.push({ index, id: String(p?.id ?? p?.number ?? '—'), reason });
      return;
    }
    // Duplicate ids break routing and React keys — keep the first, drop the rest.
    const key = (p.id as string).toLowerCase();
    if (seen.has(key)) {
      dropped.push({ index, id: p.id as string, reason: 'duplicate id' });
      return;
    }
    seen.add(key);
    projects.push(p as Project);
  });

  if (dropped.length > 0) {
    console.error(
      `[Kalb Atlas] ${dropped.length} project row(s) could not be rendered ` +
        'and were skipped:',
      dropped
    );
  }
  // Every row unusable means the file is wrong, not that the company has no
  // work. Fail loudly rather than paint an empty valley.
  if (projects.length === 0) {
    throw new ProjectDataError(
      `data/projects.json parsed but produced no renderable projects ` +
        `(${dropped.length} row(s) rejected).`
    );
  }
  return { projects, dropped };
}
