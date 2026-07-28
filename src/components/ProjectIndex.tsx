import { useMemo } from 'react';
import type { Project, Team } from '../types';
import { cityGroupOf } from '../lib/meta';
import { countByTeam, teamColor, teamIdOf, teamsInUse } from '../lib/teams';

interface ProjectIndexProps {
  projects: Project[];
  /** Projects passing the dock filters. */
  visibleIds: Set<string>;
  selectedId: string | null;
  teams: Team[];
  /** Team ids currently highlighted; empty = show all. */
  activeTeams: Set<string>;
  onToggleTeam: (id: string) => void;
  onClearTeams: () => void;
  onSelect: (p: Project) => void;
}

/**
 * Right-hand rail: every project indexed by location (cities A→Z, projects
 * A→Z inside each), plus the color-coded team legend. Tapping a row flies
 * the map to that project; tapping a legend swatch highlights that team.
 */
export function ProjectIndex({
  projects,
  visibleIds,
  selectedId,
  teams,
  activeTeams,
  onToggleTeam,
  onClearTeams,
  onSelect
}: ProjectIndexProps) {
  const groups = useMemo(() => {
    const byCity = new Map<string, Project[]>();
    for (const p of projects) {
      if (!visibleIds.has(p.id)) continue;
      const key = `${cityGroupOf(p)}`;
      const list = byCity.get(key);
      if (list) list.push(p);
      else byCity.set(key, [p]);
    }
    return [...byCity.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([city, list]) => ({
        city,
        list: [...list].sort((a, b) =>
          (a.shortName ?? a.name).localeCompare(b.shortName ?? b.name)
        )
      }));
  }, [projects, visibleIds]);

  const legend = useMemo(() => teamsInUse(teams, projects), [teams, projects]);
  const total = groups.reduce((n, g) => n + g.list.length, 0);

  return (
    <aside className="index-rail" aria-label="Project index">
      <header className="index-head">
        <span className="index-title">PROJECT INDEX</span>
        <span className="index-count">{total}</span>
      </header>

      <div className="index-scroll">
        {groups.map((g) => (
          <section key={g.city} className="index-group">
            <h3 className="index-city">
              {g.city}
              <span className="index-city-count">{g.list.length}</span>
            </h3>
            {g.list.map((p) => {
              const tid = teamIdOf(p);
              const muted =
                activeTeams.size > 0 && !activeTeams.has(tid);
              return (
                <button
                  key={p.id}
                  className={`index-row${selectedId === p.id ? ' is-active' : ''}${
                    muted ? ' is-muted' : ''
                  }`}
                  onClick={() => onSelect(p)}
                  title={`${p.number} · ${p.name} — ${p.address}`}
                >
                  <span
                    className="index-dot"
                    style={{ background: teamColor(teams, tid) }}
                    aria-hidden="true"
                  />
                  <span className="index-num">{p.number}</span>
                  <span className="index-name">{p.shortName ?? p.name}</span>
                </button>
              );
            })}
          </section>
        ))}
        {total === 0 && (
          <p className="index-empty">No projects match the current filters.</p>
        )}
      </div>

      <footer className="legend">
        <div className="legend-head">
          <span className="legend-title">TEAMS</span>
          {activeTeams.size > 0 && (
            <button className="legend-clear" onClick={onClearTeams}>
              Show all
            </button>
          )}
        </div>
        <div className="legend-items">
          {legend.map((t) => {
            const on = activeTeams.size === 0 || activeTeams.has(t.id);
            return (
              <button
                key={t.id}
                className={`legend-item${on ? '' : ' is-off'}`}
                onClick={() => onToggleTeam(t.id)}
                aria-pressed={activeTeams.has(t.id)}
              >
                <span
                  className="legend-swatch"
                  style={{ background: t.color }}
                  aria-hidden="true"
                />
                <span className="legend-name">{t.name}</span>
                <span className="legend-count">
                  {countByTeam(projects, t.id)}
                </span>
              </button>
            );
          })}
        </div>
      </footer>
    </aside>
  );
}
