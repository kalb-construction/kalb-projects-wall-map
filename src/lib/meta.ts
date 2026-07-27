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
  'Design-Build'
];

export const STATUSES: ProjectStatus[] = [
  'Preconstruction',
  'In Progress',
  'Closeout',
  'Complete'
];

/** Filter groups shown in the City chip tray. */
export const CITY_GROUPS = [
  'Las Vegas',
  'North Las Vegas',
  'Henderson',
  'Northern Nevada',
  'Arizona'
] as const;

export function cityGroupOf(project: Project): string {
  if (project.region === 'NNV') return 'Northern Nevada';
  if (project.region === 'AZ') return 'Arizona';
  return project.city;
}

export function statusTone(status: ProjectStatus): 'active' | 'precon' | 'done' {
  if (status === 'In Progress') return 'active';
  if (status === 'Preconstruction') return 'precon';
  return 'done';
}
