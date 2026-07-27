import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import projectsData from './data/projects.json';
import type { Filters, Project } from './types';
import { EMPTY_FILTERS, matchesFilters } from './lib/filters';
import { cityGroupOf } from './lib/meta';
import { boundsOf, REGIONS, type BBox } from './lib/regions';
import { useIdle } from './lib/useIdle';
import { BootScreen } from './components/BootScreen';
import { TopBar } from './components/TopBar';
import { MapLibreView } from './components/MapLibreView';
import { MapboxView, MAPBOX_TOKEN } from './components/MapboxView';
import { RegionNav } from './components/RegionNav';
import { Dock } from './components/Dock';
import { SearchOverlay } from './components/SearchOverlay';
import { ProjectDetail } from './components/ProjectDetail';
import { IdleAttract } from './components/IdleAttract';

const PROJECTS = projectsData as Project[];
const IDLE_MS = 90_000;
const BOOT_MIN_MS = 1800;
const BOOT_MAX_MS = 8000;

function idFromHash(): string | null {
  const m = window.location.hash.match(/^#\/project\/(.+)$/);
  return m ? m[1] : null;
}

export default function App() {
  const [mapLoaded, setMapLoaded] = useState(false);
  const [bootMinDone, setBootMinDone] = useState(false);
  const [bootGone, setBootGone] = useState(false);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(idFromHash);
  const [focusSignal, setFocusSignal] = useState<{ id: string; n: number } | null>(
    null
  );
  const [regionSignal, setRegionSignal] = useState<{ bounds: BBox; n: number } | null>(
    null
  );
  const [searchOpen, setSearchOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const signalCounter = useRef(0);
  const idle = useIdle(IDLE_MS);

  const bootDone = (mapLoaded && bootMinDone) || false;

  useEffect(() => {
    const t1 = window.setTimeout(() => setBootMinDone(true), BOOT_MIN_MS);
    // Hard fallback so a blocked tile server can't wedge the boot screen.
    const t2 = window.setTimeout(() => setMapLoaded(true), BOOT_MAX_MS);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  useEffect(() => {
    if (!bootDone) return;
    const t = window.setTimeout(() => setBootGone(true), 700);
    return () => window.clearTimeout(t);
  }, [bootDone]);

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

  const featured = useMemo(() => PROJECTS.filter((p) => p.featured), []);
  const cityCount = useMemo(
    () => new Set(PROJECTS.map((p) => `${p.city}|${p.state}`)).size,
    []
  );

  const flyToBounds = useCallback((bounds: BBox) => {
    signalCounter.current += 1;
    setRegionSignal({ bounds, n: signalCounter.current });
  }, []);

  const select = useCallback((p: Project) => {
    setSelectedId(p.id);
    window.location.hash = `#/project/${p.id}`;
    signalCounter.current += 1;
    setFocusSignal({ id: p.id, n: signalCounter.current });
  }, []);

  const close = useCallback(() => {
    setSelectedId(null);
    if (window.location.hash) {
      history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  /**
   * Filter changes from the dock. Picking a city also flies the camera to
   * that city's projects, so Henderson / Northern Nevada / Arizona are one
   * tap away.
   */
  const handleFilters = useCallback(
    (next: Filters) => {
      setFilters((prev) => {
        if (next.city !== prev.city && next.city !== 'all') {
          const matching = PROJECTS.filter((p) => cityGroupOf(p) === next.city);
          const b = boundsOf(matching);
          if (b) flyToBounds(b);
        }
        if (next.city === 'all' && prev.city !== 'all') {
          flyToBounds(REGIONS[0].bounds);
        }
        return next;
      });
    },
    [flyToBounds]
  );

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

  const showAttract = bootGone && idle && featured.length > 0;

  // Mapbox Standard engine when a token is configured; keyless MapLibre
  // engine otherwise. Same props, same chrome — just a better renderer.
  const MapEngine = MAPBOX_TOKEN ? MapboxView : MapLibreView;

  return (
    <div className="app">
      <MapEngine
        projects={PROJECTS}
        visibleIds={visibleIds}
        selectedId={selectedId}
        detailOpen={selected !== null}
        focusSignal={focusSignal}
        regionSignal={regionSignal}
        onSelect={select}
        onBackgroundTap={close}
        onLoaded={() => setMapLoaded(true)}
      />

      <div className="vignette" aria-hidden="true" />

      <TopBar
        totalCount={PROJECTS.length}
        shownCount={shownProjects.length}
        cityCount={cityCount}
        onSearch={() => setSearchOpen(true)}
      />

      <RegionNav
        projects={PROJECTS}
        visibleIds={visibleIds}
        onFly={flyToBounds}
      />

      <Dock
        filters={filters}
        onFilters={handleFilters}
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

      {!bootGone && <BootScreen leaving={bootDone} />}
    </div>
  );
}
