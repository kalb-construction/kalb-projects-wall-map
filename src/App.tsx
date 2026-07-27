import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import projectsData from './data/projects.json';
import type { Filters, Project } from './types';
import { EMPTY_FILTERS, matchesFilters } from './lib/filters';
import { cityGroupOf } from './lib/meta';
import { useIdle } from './lib/useIdle';
import { BootScreen } from './components/BootScreen';
import { TopBar } from './components/TopBar';
import { MapView } from './components/MapView';
import { InsetPanels } from './components/InsetPanels';
import { Dock } from './components/Dock';
import { SearchOverlay } from './components/SearchOverlay';
import { ProjectDetail } from './components/ProjectDetail';
import { IdleAttract } from './components/IdleAttract';

const PROJECTS = projectsData as Project[];
const IDLE_MS = 90_000;
const BOOT_MS = 2200;

function idFromHash(): string | null {
  const m = window.location.hash.match(/^#\/project\/(.+)$/);
  return m ? m[1] : null;
}

export default function App() {
  const [booted, setBooted] = useState(false);
  const [bootLeaving, setBootLeaving] = useState(false);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(idFromHash);
  const [focusSignal, setFocusSignal] = useState<{ id: string; n: number } | null>(
    null
  );
  const [searchOpen, setSearchOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const focusCounter = useRef(0);
  const idle = useIdle(IDLE_MS);

  // Branded boot sequence.
  useEffect(() => {
    const t1 = window.setTimeout(() => setBootLeaving(true), BOOT_MS);
    const t2 = window.setTimeout(() => setBooted(true), BOOT_MS + 650);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  // Hash <-> selection sync (deep links like #/project/26104).
  useEffect(() => {
    const onHash = () => setSelectedId(idFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const selected = useMemo(
    () => PROJECTS.find((p) => p.id === selectedId) ?? null,
    [selectedId]
  );

  const visibleIds = useMemo(() => {
    const s = new Set<string>();
    for (const p of PROJECTS) {
      if (matchesFilters(p, filters)) s.add(p.id);
    }
    return s;
  }, [filters]);

  const shownProjects = useMemo(
    () => PROJECTS.filter((p) => visibleIds.has(p.id)),
    [visibleIds]
  );

  const lvProjects = useMemo(
    () => PROJECTS.filter((p) => p.region === 'LV'),
    []
  );
  const featured = useMemo(() => PROJECTS.filter((p) => p.featured), []);
  const cityCount = useMemo(
    () => new Set(PROJECTS.map((p) => `${p.city}|${p.state}`)).size,
    []
  );

  const select = useCallback((p: Project) => {
    setSelectedId(p.id);
    window.location.hash = `#/project/${p.id}`;
    if (p.region === 'LV') {
      focusCounter.current += 1;
      setFocusSignal({ id: p.id, n: focusCounter.current });
    }
  }, []);

  const close = useCallback(() => {
    setSelectedId(null);
    if (window.location.hash) {
      history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  const step = useCallback(
    (dir: 1 | -1) => {
      if (!selected) return;
      const list = shownProjects.length > 0 ? shownProjects : PROJECTS;
      const idx = list.findIndex((p) => p.id === selected.id);
      const next = list[(idx + dir + list.length) % list.length];
      select(next);
    },
    [selected, shownProjects, select]
  );

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3400);
  }, []);

  const handleOpenProject = useCallback(
    (p: Project) => {
      showToast(
        `Project ${p.number} — ready to link to your PM system (see README).`
      );
    },
    [showToast]
  );

  const showAttract = booted && idle && featured.length > 0;

  return (
    <div className="app">
      <MapView
        projects={lvProjects}
        visibleIds={visibleIds}
        selectedId={selectedId}
        detailOpen={selected !== null}
        focusSignal={focusSignal}
        onSelect={select}
        onBackgroundTap={close}
      />

      <div className="vignette" aria-hidden="true" />

      <TopBar
        totalCount={PROJECTS.length}
        shownCount={shownProjects.length}
        cityCount={cityCount}
        onSearch={() => setSearchOpen(true)}
      />

      <InsetPanels
        projects={PROJECTS}
        visibleIds={visibleIds}
        selectedId={selectedId}
        onSelect={select}
      />

      <Dock
        filters={filters}
        onFilters={setFilters}
        shownCount={shownProjects.length}
        featured={featured}
        selectedId={selectedId}
        onSelect={select}
      />

      {selected && (
        <ProjectDetail
          project={selected}
          onClose={close}
          onPrev={() => step(-1)}
          onNext={() => step(1)}
          onOpenProject={handleOpenProject}
        />
      )}

      {searchOpen && (
        <SearchOverlay
          projects={PROJECTS}
          onSelect={select}
          onClose={() => setSearchOpen(false)}
        />
      )}

      {toast && <div className="toast">{toast}</div>}

      {showAttract && <IdleAttract featured={featured} />}

      {!booted && <BootScreen leaving={bootLeaving} />}
    </div>
  );
}
