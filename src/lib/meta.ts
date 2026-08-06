import type { Category, Project, ProjectStatus } from '../types';

export const CATEGORIES: Category[] = [
  'Retail',
  'Restaurant',
  'Office & TI',
  'Industrial',
  'Civic & Housing',
  'Medical',
  'Tavern & Gaming',
  'Automotive & Storage',
  'Recreation & Events',
  'Civil & Sitework',
  'Design-Build'
];

// 'Closeout' is retired as a display status (mapped to In Progress at
// load — see lib/status.ts), so the Status filter doesn't offer it.
export const STATUSES: ProjectStatus[] = [
  'Preconstruction',
  'In Progress',
  'Complete'
];

/**
 * Projects group by their actual city everywhere (index rail, City
 * filter). Broad areas are handled separately by the Regions quick-nav.
 */
export function cityGroupOf(project: Project): string {
  return project.city;
}

/** Every city present in the data, alphabetical — drives the City tray. */
export function cityOptionsOf(projects: Project[]): string[] {
  return [...new Set(projects.map(cityGroupOf))].sort((a, b) =>
    a.localeCompare(b)
  );
}

export function statusTone(status: ProjectStatus): 'active' | 'precon' | 'done' {
  if (status === 'In Progress') return 'active';
  if (status === 'Preconstruction') return 'precon';
  return 'done';
}
