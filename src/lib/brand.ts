import type { Developer, Project } from '../types';
import { KALB_RED_ACTIVE } from './kiosk';

/**
 * Pin colours — status first, then whose project it is.
 *
 * Anything finished is grey, whoever built it: a completed job is history,
 * and history should recede so live work carries the wall. Among the work
 * that is still going or still coming, Kalb is red and BLAK is green.
 *
 * So the wall reads at a glance: grey = done, red = Kalb building now,
 * green = BLAK building now. (Kalb, 2026-08-17 — this supersedes the
 * earlier rule that every Kalb pin was red regardless of status.)
 */
export const KALB_RED = KALB_RED_ACTIVE;
/** BLAK brand green — PMS 5747 U. */
export const BLAK_GREEN = '#5F6638';
/** BLAK brand grey — PMS 425 U. Now used for ALL completed work. */
export const COMPLETE_GREY = '#54575A';
/** @deprecated kept as an alias; the grey is no longer BLAK-specific. */
export const BLAK_GREY = COMPLETE_GREY;

export function developerOf(p: Project): Developer {
  return p.developer ?? 'kalb';
}

export function isBlak(p: Project): boolean {
  return developerOf(p) === 'blak';
}

/** The colour a project's marker, index dot, and legend swatch all use. */
export function pinColor(p: Project): string {
  if (p.status === 'Complete') return COMPLETE_GREY;
  return isBlak(p) ? BLAK_GREEN : KALB_RED;
}

/** Finished work — the "history" the wall can filter out. */
export function isHistory(p: Project): boolean {
  return p.status === 'Complete';
}

/** Letter shown inside a single-project pin. */
export function pinGlyph(p: Project): string {
  return isBlak(p) ? 'B' : 'K';
}

export const DEVELOPER_LABEL: Record<Developer, string> = {
  kalb: 'Kalb Construction',
  blak: 'BLAK Development'
};
