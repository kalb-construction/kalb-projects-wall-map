import type { Project, Team } from '../types';

export const UNASSIGNED_ID = 'unassigned';

export const FALLBACK_TEAMS: Team[] = [
  { id: UNASSIGNED_ID, name: 'Unassigned', color: '#C10016' }
];

/** A project's team id, defaulting to "unassigned" when none is set. */
export function teamIdOf(p: Project): string {
  return p.team && p.team.trim() !== '' ? p.team : UNASSIGNED_ID;
}

export function teamColor(teams: Team[], id: string): string {
  return teams.find((t) => t.id === id)?.color ?? '#C10016';
}

export function teamName(teams: Team[], id: string): string {
  return teams.find((t) => t.id === id)?.name ?? 'Unassigned';
}

/**
 * Team ids that actually appear in the data, in teams.json order.
 *
 * "Unassigned" is deliberately excluded. The legend is a filter over
 * project managers, and the historical jobs imported from the job folders
 * carry no PM — that vocabulary lives only on the PM sheet, which covers
 * active work. Listing them as a team turns an absence of data into what
 * looks like a person with a caseload.
 */
export function teamsInUse(teams: Team[], projects: Project[]): Team[] {
  const used = new Set(projects.map(teamIdOf));
  used.delete(UNASSIGNED_ID);
  const known = teams.filter((t) => t.id !== UNASSIGNED_ID && used.has(t.id));
  // Any id referenced by a project but missing from teams.json.
  const extra = [...used]
    .filter((id) => !teams.some((t) => t.id === id))
    .map((id) => ({ id, name: id, color: '#8C8880' }));
  return [...known, ...extra];
}

export function countByTeam(projects: Project[], id: string): number {
  return projects.filter((p) => teamIdOf(p) === id).length;
}
