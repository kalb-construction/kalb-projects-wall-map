import { memo, useMemo, useState } from 'react';
import type { Project, Team } from '../types';
import { cityGroupOf } from '../lib/meta';
import { countByTeam, teamIdOf, teamsInUse } from '../lib/teams';
import { pinColor } from '../lib/brand';

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
 * Collapsible right-hand rail: every project indexed by location (cities
 * A→Z, projects A→Z inside each), plus the color-coded team legend.
 * Tapping a row flies the map there; tapping a team filters to that team.
 */
function ProjectIndexBase({
  projects,
  visibleIds,
  selectedId,
  teams,
  activeTeams,
  onToggleTeam,
  onClearTeams,
  onSelect
}: ProjectIndexProps) {
  const [open, setOpen] = useState(true);

  const groups = useMemo(() => {
    const byCity = new Map<string, Project[]>();
    for (const p of projects) {
      if (!visibleIds.has(p.id)) continue;
      const key = cityGroupOf(p);
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
    <aside
      className={`index-rail${open ? ' is-open' : ''}`}
      aria-label="Project index"
    >
      <button
        className="panel-toggle"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span className="panel-toggle-label">PROJECT INDEX</span>
        <span className="panel-toggle-meta">{total}</span>
        <svg viewBox="0 0 12 8" aria-hidden="true" className="panel-caret">
          <path
            d="M1 2 6 7 11 2"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {open && (
        <>
          <div className="index-scroll">
            {groups.map((g) => (
              <section key={g.city} className="index-group">
                <h3 className="index-city">
                  {g.city}
                  <span className="index-city-count">{g.list.length}</span>
                </h3>
                {g.list.map((p) => {
                  const tid = teamIdOf(p);
                  const muted = activeTeams.size > 0 && !activeTeams.has(tid);
                  return (
                    <button
                      key={p.id}
                      className={`index-row${
                        selectedId === p.id ? ' is-active' : ''
                      }${muted ? ' is-muted' : ''}`}
                      onClick={() => onSelect(p)}
                      title={`${p.number} · ${p.name} — ${p.address}`}
                    >
                      <span
                        className="index-dot"
                        style={{ background: pinColor(p) }}
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
              <span className="legend-title">TEAMS &amp; DEVELOPERS</span>
              <button
                className="legend-clear"
                onClick={onClearTeams}
                disabled={activeTeams.size === 0}
              >
                Show all
              </button>
            </div>
            <div className="legend-items">
              {legend.map((t) => {
                const picked = activeTeams.has(t.id);
                const dimmed = activeTeams.size > 0 && !picked;
                return (
                  <button
                    key={t.id}
                    className={`legend-item${picked ? ' is-picked' : ''}${
                      dimmed ? ' is-off' : ''
                    }`}
                    onClick={() => onToggleTeam(t.id)}
                    aria-pressed={picked}
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
        </>
      )}
    </aside>
  );
}

/** Memoized: only re-renders when its own props actually change. */
export const ProjectIndex = memo(ProjectIndexBase);
