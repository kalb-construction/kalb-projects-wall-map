import type { Filters, Project } from '../types';
import { cityGroupOf } from './meta';

export const EMPTY_FILTERS: Filters = {
  city: 'all',
  category: 'all',
  status: 'all'
};

export function matchesFilters(project: Project, filters: Filters): boolean {
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
