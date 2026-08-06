import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Filters, Project, Team } from './types';
import { EMPTY_FILTERS, matchesFilters } from './lib/filters';
import { cityGroupOf, cityOptionsOf } from './lib/meta';
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
import { ProjectIndex } from './components/ProjectIndex';
import { DiagOverlay } from './components/DiagOverlay';
import { FALLBACK_TEAMS, teamIdOf } from './lib/teams';

/** `?diag=1` shows the on-screen engine/dpr/fps readout (kiosk-friendly). */
const SHOW_DIAG = new URLSearchParams(window.location.search).has('diag');

const IDLE_MS = 90_000;
const BOOT_MIN_MS = 1800;
const BOOT_MAX_MS = 8000;

/**
 * Project data is loaded at runtime from a plain file so the team can
 * update the dashboard without a rebuild: edit data/projects.json (in
 * public/ during development, or directly inside dist/ on the kiosk),
 * then refresh the page.
 */
async function loadProjects(): Promise<Project[]> {
  const res = await fetch('./data/projects.json', { cache: 'no-store' });
  if (!res.ok) throw new Error(`projects.json ${res.status}`);
  return (await res.json()) as Project[];
}

/** Teams are optional: a missing/broken file just means one grey team. */
async function loadTeams(): Promise<Team[]> {
  try {
    const res = await fetch('./data/teams.json', { cache: 'no-store' });
    if (!res.ok) return FALLBACK_TEAMS;
    const data = (await res.json()) as Team[];
    return Array.isArray(data) && data.length > 0 ? data : FALLBACK_TEAMS;
  } catch {
    return FALLBACK_TEAMS;
  }
}

function idFromHash(): string | null {
  const m = window.location.hash.match(/^#\/project\/(.+)$/);
  return m ? m[1] : null;
}

export default function App() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [teams, setTeams] = useState<Team[]>(FALLBACK_TEAMS);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    loadProjects()
      .then(setProjects)
      .catch(() => setLoadError(true));
    loadTeams().then(setTeams);
  }, []);

  if (loadError) {
    return (
      <div className="app">
        <BootScreen leaving={false} />
        <div className="g-error">
          Could not read data/projects.json — check the file and refresh.
        </div>
      </div>
    );
  }
  if (!projects) {
    return (
      <div className="app">
        <BootScreen leaving={false} />
      </div>
    );
  }
  return <Atlas projects={projects} teams={teams} />;
}

function Atlas({ projects, teams }: { projects: Project[]; teams: Team[] }) {
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
  const [mapboxFailed, setMapboxFailed] = useState(false);
  const [activeTeams, setActiveTeams] = useState<Set<string>>(new Set());
  const [northSignal, setNorthSignal] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const signalCounter = useRef(0);
  const idle = useIdle(IDLE_MS);

  const bootDone = mapLoaded && bootMinDone;

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
    () => projects.find((p) => p.id === selectedId) ?? null,
    [projects, selectedId]
  );

  /** Passes the dock filters (city/type) — drives the index rail. */
  const filteredIds = useMemo(() => {
    const s = new Set<string>();
    for (const p of projects) {
      if (matchesFilters(p, filters)) s.add(p.id);
    }
    return s;
  }, [projects, filters]);

  /** Filters + team highlight — drives which markers are lit on the map. */
  const visibleIds = useMemo(() => {
    if (activeTeams.size === 0) return filteredIds;
    const s = new Set<string>();
    for (const p of projects) {
      if (filteredIds.has(p.id) && activeTeams.has(teamIdOf(p))) s.add(p.id);
    }
    return s;
  }, [projects, filteredIds, activeTeams]);

  const toggleTeam = useCallback((id: string) => {
    setActiveTeams((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const shownProjects = useMemo(
    () => projects.filter((p) => visibleIds.has(p.id)),
    [projects, visibleIds]
  );

  const featured = useMemo(() => projects.filter((p) => p.featured), [projects]);
  const cityCount = useMemo(
    () => new Set(projects.map((p) => `${p.city}|${p.state}`)).size,
    [projects]
  );
  const cityOptions = useMemo(() => cityOptionsOf(projects), [projects]);

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
          const matching = projects.filter((p) => cityGroupOf(p) === next.city);
          const b = boundsOf(matching);
          if (b) flyToBounds(b);
        }
        if (next.city === 'all' && prev.city !== 'all') {
          flyToBounds(REGIONS[0].bounds);
        }
        return next;
      });
    },
    [projects, flyToBounds]
  );

  const step = useCallback(
    (dir: 1 | -1) => {
      if (!selected) return;
      const list = shownProjects.length > 0 ? shownProjects : projects;
      const idx = list.findIndex((p) => p.id === selected.id);
      const next = list[(idx + dir + list.length) % list.length];
      select(next);
    },
    [selected, shownProjects, projects, select]
  );

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3400);
  }, []);

  const showAttract = bootGone && idle && featured.length > 0;

  useEffect(() => {
    // Visible in DevTools → Console, so it's obvious which engine is live.
    console.info(
      MAPBOX_TOKEN
        ? '[Kalb Atlas] Mapbox engine active.'
        : '[Kalb Atlas] No VITE_MAPBOX_TOKEN found — running the free ' +
            'MapLibre engine. Check that .env exists, is saved as UTF-8, ' +
            'and that the dev server was restarted after creating it.'
    );
  }, []);

  // Mapbox Standard engine when a token is configured; the keyless
  // MapLibre engine otherwise — or as an automatic rescue if Mapbox
  // can't render (bad token, blocked host), so the wall is never blank.
  const useMapbox = MAPBOX_TOKEN !== null && !mapboxFailed;

  return (
    <div className={`app${selected ? ' detail-open' : ''}`}>
      {useMapbox ? (
        <MapboxView
          projects={projects}
          visibleIds={visibleIds}
          selectedId={selectedId}
          detailOpen={selected !== null}
          focusSignal={focusSignal}
          regionSignal={regionSignal}
          onSelect={select}
          onBackgroundTap={close}
          onLoaded={() => setMapLoaded(true)}
          northSignal={northSignal}
          onFailure={(reason) => {
            setMapboxFailed(true);
            setMapLoaded(true);
            showToast(`Mapbox unavailable (${reason}) — using standard maps.`);
          }}
        />
      ) : (
        <MapLibreView
          projects={projects}
          visibleIds={visibleIds}
          selectedId={selectedId}
          detailOpen={selected !== null}
          focusSignal={focusSignal}
          regionSignal={regionSignal}
          onSelect={select}
          onBackgroundTap={close}
          onLoaded={() => setMapLoaded(true)}
          northSignal={northSignal}
        />
      )}

      <div className="vignette" aria-hidden="true" />

      <TopBar
        totalCount={projects.length}
        shownCount={shownProjects.length}
        cityCount={cityCount}
        onSearch={() => setSearchOpen(true)}
      />

      <RegionNav
        projects={projects}
        visibleIds={visibleIds}
        onFly={flyToBounds}
      />

      <Dock
        filters={filters}
        onFilters={handleFilters}
        shownCount={shownProjects.length}
        cityOptions={cityOptions}
        onNorth={() => setNorthSignal((n) => n + 1)}
      />

      <ProjectIndex
        projects={projects}
        visibleIds={filteredIds}
        selectedId={selectedId}
        teams={teams}
        activeTeams={activeTeams}
        onToggleTeam={toggleTeam}
        onClearTeams={() => setActiveTeams(new Set())}
        onSelect={select}
      />

      {selected && (
        <ProjectDetail
          project={selected}
          teams={teams}
          onClose={close}
          onPrev={() => step(-1)}
          onNext={() => step(1)}
        />
      )}

      {searchOpen && (
        <SearchOverlay
          projects={projects}
          onSelect={select}
          onClose={() => setSearchOpen(false)}
        />
      )}

      {toast && <div className="toast">{toast}</div>}

      {SHOW_DIAG && <DiagOverlay engine={useMapbox ? 'Mapbox' : 'MapLibre'} />}

      {showAttract && <IdleAttract featured={featured} />}

      {!bootGone && <BootScreen leaving={bootDone} />}
    </div>
  );
}
