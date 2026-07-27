import { useEffect, useRef, useState } from 'react';
import type { Project } from '../types';
import { searchProjects } from '../lib/filters';
import { statusTone } from '../lib/meta';

interface SearchOverlayProps {
  projects: Project[];
  onSelect: (p: Project) => void;
  onClose: () => void;
}

export function SearchOverlay({ projects, onSelect, onClose }: SearchOverlayProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const results = searchProjects(projects, query);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="search-overlay" onClick={onClose}>
      <div
        className="search-panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Search projects"
      >
        <div className="search-input-row">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              d="M10.5 3.8a6.7 6.7 0 1 1 0 13.4 6.7 6.7 0 0 1 0-13.4Zm4.9 11.6 4.6 4.6"
            />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Project number, name, or address…"
            aria-label="Search query"
          />
          <button className="nav-btn" onClick={onClose} aria-label="Close search">
            ✕
          </button>
        </div>

        {query.trim() !== '' && (
          <ul className="search-results">
            {results.length === 0 && (
              <li className="search-empty">No projects match “{query}”.</li>
            )}
            {results.map((p) => (
              <li key={p.id}>
                <button
                  className="search-row"
                  onClick={() => {
                    onSelect(p);
                    onClose();
                  }}
                >
                  <span className="sr-number">{p.number}</span>
                  <span className="sr-body">
                    <span className="sr-name">{p.name}</span>
                    <span className="sr-addr">
                      {p.address} · {p.city}, {p.state}
                    </span>
                  </span>
                  <span className={`chip chip-status tone-${statusTone(p.status)}`}>
                    {p.status}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
