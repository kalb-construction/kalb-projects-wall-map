import type { Filters, Project } from '../types';
import { cityGroupOf } from './meta';
import { isHistory } from './brand';

export const EMPTY_FILTERS: Filters = {
  city: 'all',
  category: 'all',
  status: 'all',
  // Completed work is shown by default; the toggle is for narrowing the
  // wall to what Kalb is building right now.
  history: true
};

export function matchesFilters(project: Project, filters: Filters): boolean {
  if (!filters.history && isHistory(project)) return false;
  if (filters.city !== 'all' && cityGroupOf(project) !== filters.city) {
    return false;
  }
  if (filters.category !== 'all' && project.category !== filters.category) {
    return false;
  }
  if (filters.status !== 'all' && project.status !== filters.status) {
    return false;
  }
  return true;
}

export function searchProjects(projects: Project[], query: string): Project[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const terms = q.split(/\s+/);
  return projects
    .filter((p) => {
      const hay = [p.number, p.name, p.shortName ?? '', p.address, p.city]
        .join(' ')
        .toLowerCase();
      return terms.every((t) => hay.includes(t));
    })
    .slice(0, 8);
}
