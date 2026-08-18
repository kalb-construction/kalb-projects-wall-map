import { useEffect, useRef, useState } from 'react';
import type { Project, Team } from '../types';
import { statusTone } from '../lib/meta';
import { teamName } from '../lib/teams';
import { teamIdOf } from '../lib/teams';
import { PhotoSlider } from './PhotoSlider';
import { isBlak, pinColor, DEVELOPER_LABEL } from '../lib/brand';
import { developerOf } from '../lib/brand';

interface ProjectDetailProps {
  project: Project;
  teams: Team[];
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}

/**
 * Compact glass card docked to the left. Deliberately narrow so the map
 * and the project index stay visible — the whole atlas reads as one page
 * rather than a panel taking over half the screen.
 */
export function ProjectDetail({
  project,
  teams,
  onClose,
  onPrev,
  onNext
}: ProjectDetailProps) {
  const heroRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });
  /** Cinematic swap: content fades through on every project change. */
  const [phase, setPhase] = useState<'loading' | 'ready'>('loading');

  useEffect(() => {
    setPhase('loading');
    const id = window.setTimeout(() => setPhase('ready'), 260);
    return () => window.clearTimeout(id);
  }, [project.id]);

  const onHeroMove = (e: React.PointerEvent) => {
    const el = heroRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width - 0.5;
    const ny = (e.clientY - r.top) / r.height - 0.5;
    setTilt({ rx: -ny * 6, ry: nx * 8 });
  };

  const tone = statusTone(project.status);
  const blak = isBlak(project);
  const hasPhotos = (project.photos?.length ?? 0) > 0;

  return (
    <aside
      className={`detail-card is-${phase}`}
      role="dialog"
      aria-label={`Project ${project.number} ${project.name}`}
    >
      {/* blueprint / glass architecture backdrop */}
      <span className="detail-blueprint" aria-hidden="true" />
      <span className="detail-sheen" aria-hidden="true" />

      <header className="detail-head">
        <span
          className={`detail-number${blak ? ' is-blak' : ''}`}
          style={blak ? { color: pinColor(project) } : undefined}
        >
          {blak ? DEVELOPER_LABEL[developerOf(project)] : `№ ${project.number}`}
        </span>
        <div className="detail-nav">
          <button className="nav-btn" aria-label="Previous project" onClick={onPrev}>
            ←
          </button>
          <button className="nav-btn" aria-label="Next project" onClick={onNext}>
            →
          </button>
          <button className="nav-btn nav-close" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>
      </header>

      <div className="detail-body">
        <h2 className="detail-name">{project.name}</h2>
        <p className="detail-address">
          <svg viewBox="0 0 24 24" className="addr-pin" aria-hidden="true">
            <path
              fill="currentColor"
              d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5Z"
            />
          </svg>
          {project.address} · {project.city}, {project.state}
        </p>

        <div className="detail-chips">
          <span className={`chip chip-status tone-${tone}`}>{project.status}</span>
          <span className="chip chip-category">
            {project.projectType ?? project.category}
          </span>
        </div>

        {/* Photos or nothing. The procedural building drawing is retired
            here by request -- a card without photography goes straight
            from the chips to the facts. */}
        {hasPhotos && (
          <div
            ref={heroRef}
            className="detail-hero has-photos"
            onPointerMove={onHeroMove}
            onPointerLeave={() => setTilt({ rx: 0, ry: 0 })}
            style={{
              transform: `perspective(900px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`
            }}
          >
            <PhotoSlider photos={project.photos!} label={project.name} />
            <span className="hero-scan" aria-hidden="true" />
          </div>
        )}

        <dl className="detail-facts">
          {blak ? (
            <>
              <div>
                <dt>Delivered</dt>
                <dd>{project.estCompletion ?? '—'}</dd>
              </div>
              <div>
                <dt>Duration</dt>
                <dd>{project.duration ?? '—'}</dd>
              </div>
            </>
          ) : (
            <>
              <div>
                <dt>Project Manager</dt>
                {/* No PM on file reads as "—" like every other absent field.
                    "Unassigned" would imply someone chose not to assign one. */}
                <dd>{project.team ? teamName(teams, teamIdOf(project)) : '—'}</dd>
              </div>
              <div>
                <dt>Superintendent</dt>
                <dd>{project.superintendent ?? '—'}</dd>
              </div>
            </>
          )}
          <div>
            <dt>Square Feet</dt>
            <dd>
              {project.sqFt
                ? project.sqFt.toLocaleString()
                : project.sqFtNote ?? '—'}
            </dd>
          </div>
          <div>
            <dt>{blak ? 'Budget' : 'Est. Completion'}</dt>
            <dd>{blak ? project.budgetOutcome ?? '—' : project.estCompletion ?? '—'}</dd>
          </div>
        </dl>

        {project.sqFtNote && project.sqFt && (
          <p className="detail-subnote">{project.sqFtNote}</p>
        )}

        {project.flags && project.flags.length > 0 && (
          <ul className="detail-flags">
            {project.flags.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        )}

        {project.siteName && (
          <p className="detail-site">
            Part of <strong>{project.siteName}</strong> — tap the cluster to
            see neighbouring jobs.
          </p>
        )}
      </div>
    </aside>
  );
}
