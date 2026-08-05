import { useEffect, useRef, useState } from 'react';
import type { Project, Team } from '../types';
import { statusTone } from '../lib/meta';
import { teamColor, teamIdOf, teamName } from '../lib/teams';
import { BuildingHero } from './BuildingHero';

interface ProjectDetailProps {
  project: Project;
  teams: Team[];
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onOpenProject: (p: Project) => void;
}

export function ProjectDetail({
  project,
  teams,
  onClose,
  onPrev,
  onNext,
  onOpenProject
}: ProjectDetailProps) {
  const heroRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });
  const [barOn, setBarOn] = useState(false);

  // Re-run the progress bar sweep whenever the project changes.
  useEffect(() => {
    setBarOn(false);
    const id = window.setTimeout(() => setBarOn(true), 120);
    return () => window.clearTimeout(id);
  }, [project.id]);

  const onHeroMove = (e: React.PointerEvent) => {
    const el = heroRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width - 0.5;
    const ny = (e.clientY - r.top) / r.height - 0.5;
    setTilt({ rx: -ny * 7, ry: nx * 9 });
  };

  const tone = statusTone(project.status);

  return (
    <aside
      className="detail-panel"
      role="dialog"
      aria-label={`Project ${project.number} ${project.name}`}
    >
      <div className="detail-head">
        <div className="detail-chips">
          <span className="chip chip-category">{project.category}</span>
          <span className={`chip chip-status tone-${tone}`}>
            {project.status}
          </span>
          {project.featured && <span className="chip chip-feat">Featured</span>}
        </div>
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
      </div>

      <div className="detail-scroll">
        <div className="detail-number">№ {project.number}</div>
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

        <div
          ref={heroRef}
          className="detail-hero"
          onPointerMove={onHeroMove}
          onPointerLeave={() => setTilt({ rx: 0, ry: 0 })}
          style={{
            transform: `perspective(1100px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`
          }}
        >
          <BuildingHero project={project} />
          {!project.heroImage && (
            <span className="hero-note">Concept visual — render slot ready</span>
          )}
        </div>

        <div className="detail-meta">
          <div className="meta-cell">
            <span className="meta-label">Project No.</span>
            <span className="meta-value">{project.number}</span>
          </div>
          <div className="meta-cell">
            <span className="meta-label">Project Manager</span>
            <span className="meta-value">
              <span
                className="pm-dot"
                style={{ background: teamColor(teams, teamIdOf(project)) }}
                aria-hidden="true"
              />
              {teamName(teams, teamIdOf(project))}
            </span>
          </div>
          <div className="meta-cell">
            <span className="meta-label">Superintendent</span>
            <span className="meta-value">{project.superintendent ?? '—'}</span>
          </div>
          <div className="meta-cell">
            <span className="meta-label">Square Feet</span>
            <span className="meta-value">
              {project.sqFt
                ? project.sqFt.toLocaleString()
                : project.sqFtNote ?? '—'}
            </span>
          </div>
          <div className="meta-cell">
            <span className="meta-label">Est. Completion</span>
            <span className="meta-value">{project.estCompletion ?? '—'}</span>
          </div>
          <div className="meta-cell">
            <span className="meta-label">Type</span>
            <span className="meta-value">
              {project.projectType ?? project.category}
            </span>
          </div>
        </div>

        {project.progress !== undefined && (
          <div className="detail-progress">
            <div className="progress-row">
              <span className="meta-label">Status — {project.status}</span>
              <span className="progress-pct">{project.progress}%</span>
            </div>
            <div className="progress-track">
              <div
                className={`progress-fill tone-${tone}`}
                style={{ width: barOn ? `${project.progress}%` : '0%' }}
              />
            </div>
          </div>
        )}

        <p className="detail-desc">{project.description}</p>

        {project.flags && project.flags.length > 0 && (
          <ul className="detail-flags">
            {project.flags.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        )}

        {project.siteName && (
          <p className="detail-site">
            Part of the <strong>{project.siteName}</strong> site — tap the
            cluster on the map to see neighboring jobs.
          </p>
        )}

        <div className="detail-ctas">
          <button className="btn btn-primary" onClick={() => onOpenProject(project)}>
            Open Project
          </button>
          <button className="btn btn-ghost" onClick={onClose}>
            Back to Map
          </button>
        </div>
      </div>
    </aside>
  );
}
