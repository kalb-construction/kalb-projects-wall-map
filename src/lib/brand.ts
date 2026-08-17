import type { Developer, Project } from '../types';

/**
 * Pin colours.
 *
 * Kalb's own jobs are always Kalb red — that rule predates BLAK and still
 * holds. BLAK Development is a separate brand on the same wall, so it uses
 * its own palette, and within BLAK the finished work reads grey while live
 * and upcoming work reads green. Colour therefore answers two questions at
 * a glance: whose project, and is it still going.
 */
export const KALB_RED = '#C10016';
/** BLAK brand green — PMS 5747 U. */
export const BLAK_GREEN = '#5F6638';
/** BLAK brand grey — PMS 425 U. Used for BLAK's completed work. */
export const BLAK_GREY = '#54575A';

export function developerOf(p: Project): Developer {
  return p.developer ?? 'kalb';
}

export function isBlak(p: Project): boolean {
  return developerOf(p) === 'blak';
}

/** The colour a project's marker, index dot, and legend swatch all use. */
export function pinColor(p: Project): string {
  if (!isBlak(p)) return KALB_RED;
  return p.status === 'Complete' ? BLAK_GREY : BLAK_GREEN;
}

/** Letter shown inside a single-project pin. */
export function pinGlyph(p: Project): string {
  return isBlak(p) ? 'B' : 'K';
}

export const DEVELOPER_LABEL: Record<Developer, string> = {
  kalb: 'Kalb Construction',
  blak: 'BLAK Development'
};
