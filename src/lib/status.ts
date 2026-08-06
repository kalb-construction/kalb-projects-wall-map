import type { Project } from '../types';

/**
 * Display status is DERIVED at load time, not trusted from the file.
 *
 * The JSON stores what Kalb actually said (estimated completion dates);
 * the wall must stay truthful as those dates pass without anyone editing
 * data. Rules, in order:
 *
 *   1. An estimated completion date in the past ⇒ Complete (the rule Kalb
 *      approved when statuses were first derived from the PM sheet).
 *   2. "Closeout" is retired as a display status — Kalb doesn't use the
 *      concept. Anything stored as Closeout shows as In Progress until
 *      its date passes.
 *   3. Everything else (Preconstruction, In Progress, Complete) is kept
 *      as stored.
 */
export function deriveStatus(p: Project, today: Date = new Date()): Project {
  if (p.status !== 'Complete' && p.estCompletionDate) {
    // End of the completion day, local time — a job isn't "past" its
    // date until that day is over.
    const due = new Date(`${p.estCompletionDate}T23:59:59`);
    if (!Number.isNaN(due.getTime()) && due < today) {
      return { ...p, status: 'Complete', progress: 100 };
    }
  }
  if (p.status === 'Closeout') {
    return { ...p, status: 'In Progress' };
  }
  return p;
}
