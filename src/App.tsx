import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Filters, Project, Team } from './types';
import { EMPTY_FILTERS, matchesFilters } from './lib/filters';
import { cityGroupOf, cityOptionsOf } from './lib/meta';
import { boundsOf, REGIONS, type BBox } from './lib/regions';
import { useIdleStage } from './lib/useIdle';
import { tourRoute } from './lib/tour';
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
import { BlakBadge } from './components/BlakBadge';
import { FALLBACK_TEAMS, teamIdOf } from './lib/teams';
import { deriveStatus } from './lib/status';
import { isBlak, isHistory } from './lib/brand';
import { watchForUpdates } from './lib/version';
import { validateProjects } from './lib/validate';
import { watchPerformance } from './lib/perf';
import { fetchJsonForever, isReachable } from './lib/fetchJson';

/** `?diag=1` shows the on-screen engine/dpr/fps readout (kiosk-friendly). */
const SHOW_DIAG = (() => {
  // `?diag=0` documented as "off" but `.has()` is true for any value, so
  // the one way anyone would try to turn it off switched it on instead.
  const v = new URLSearchParams(window.location.search).get('diag');
  return v !== null && v !== '0' && v !== 'false';
})();

/**
 * The unattended ladder. Left alone, the wall escalates:
 *
 *   45s   the camera tour takes over — flies job to job, playing photos
 *   225s  the tour hands off to the full-screen screensaver
 *
 * Any touch, key or mouse move drops straight back to stage 0 and the
 * display is manual again. 45 seconds is long enough that it never
 * interrupts somebody reading a card, short enough that a lobby with
 * nobody in it is never showing a still frame.
 */
const TOUR_IDLE_MS = 45_000;

/**
 * `?tour=0` switches the camera tour off and leaves the wall on a still
 * map until the screensaver. Some rooms want the movement, some find it
 * distracting behind a meeting; it is a display setting, not a rebuild.
 */
const TOUR_ENABLED = (() => {
  const v = new URLSearchParams(window.location.search).get('tour');
  return v === null || (v !== '0' && v !== 'false');
})();
const ATTRACT_IDLE_MS = 225_000;

/** Per stop: a ~5s flight, then long enough for three photos to play. */
const TOUR_STEP_MS = 13_500;

const BOOT_MIN_MS = 1800;
const BOOT_MAX_MS = 8000;

/**
 * Project data is loaded at runtime from a plain file so the team can
 * update the dashboard without a rebuild: edit data/projects.json (in
 * public/ during development, or directly inside dist/ on the kiosk),
 * then refresh the page.
 */
async function loadProjects(
  onAttemptFailed: (attempt: number, error: unknown) => void,
  signal: AbortSignal
): Promise<Project[]> {
  // Retries forever rather than failing: the display boots whenever the
  // building does, so its first request can land before the network is up.
  // Validation runs inside the retry, so a file caught mid-write is
  // re-read rather than treated as a dead display.
  return fetchJsonForever<unknown, Project[]>('./data/projects.json', {
    onAttemptFailed,
    signal,
    parse: (raw) => {
      // Guard before render: one unrenderable row must not blank the wall.
      const { projects } = validateProjects(raw);
      // Status is derived from the estimated completion date at load time,
      // so the wall stays current as dates pass without anyone editing.
      return projects.map((p) => deriveStatus(p));
    }
  });
}

/** Teams are optional: a missing/broken file just means one grey team. */
async function loadTeams(signal: AbortSignal): Promise<Team[]> {
  try {
    // Retries like projects.json does. A boot-time blip used to be
    // permanent here: teams got one attempt, and losing it silently
    // replaced every project manager on the wall with one grey
    // "Unassigned" for the rest of the run.
    return await fetchJsonForever<Team[], Team[]>('./data/teams.json', {
      signal,
      parse: (data) => {
        if (!Array.isArray(data) || data.length === 0) {
          throw new Error('teams.json is empty or not an array');
        }
        return data;
      }
    });
  } catch {
    // Abort only (unmount) — the loop itself does not give up.
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
  /** Failed attempts so far. Non-zero only while the data is unreachable. */
  const [retrying, setRetrying] = useState(0);

  useEffect(() => {
    const ac = new AbortController();
    loadProjects((attempt) => setRetrying(attempt), ac.signal)
      .then((p) => {
        setRetrying(0);
        setProjects(p);
        // Reaching here means the app got past the failure that spent any
        // of the error boundary's retry budget, so give it back.
        try {
          sessionStorage.removeItem('kalb-atlas-auto-reloads');
        } catch {
          /* nothing to clear */
        }
      })
      .catch(() => {
        /* only ever an abort — the loader itself does not give up */
      });
    loadTeams(ac.signal).then(setTeams);
    return () => ac.abort();
  }, []);

  if (!projects) {
    return (
      <div className="app">
        <BootScreen leaving={false} />
        {/* The boot screen alone would look identical to a slow start, so
            say what is happening once it is clearly not just slow. The
            loader is still going; nobody needs to do anything. */}
        {retrying > 2 && (
          <div className="g-error g-error-retry">
            Waiting for data/projects.json — retrying…
            <span className="g-error-hint">
              Attempt {retrying}. This recovers on its own once the network
              is back.
            </span>
          </div>
        )}
      </div>
    );
  }
  return <Atlas projects={projects} teams={teams} />;
}

function Atlas({
  projects: initialProjects,
  teams
}: {
  projects: Project[];
  teams: Team[];
}) {
  const [projects, setLiveProjects] = useState<Project[]>(initialProjects);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [bootMinDone, setBootMinDone] = useState(false);
  const [bootGone, setBootGone] = useState(false);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(idFromHash);
  const [focusSignal, setFocusSignal] = useState<{
    id: string;
    n: number;
    tour?: boolean;
  } | null>(null);
  const [regionSignal, setRegionSignal] = useState<{ bounds: BBox; n: number } | null>(
    null
  );
  const [searchOpen, setSearchOpen] = useState(false);
  const [mapboxFailed, setMapboxFailed] = useState(false);
  const [activeTeams, setActiveTeams] = useState<Set<string>>(new Set());
  const [northSignal, setNorthSignal] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [diagOn, setDiagOn] = useState(SHOW_DIAG);
  const toastTimer = useRef<number | undefined>(undefined);
  const signalCounter = useRef(0);
  const idleStage = useIdleStage([TOUR_IDLE_MS, ATTRACT_IDLE_MS]);
  const idle = idleStage > 0;
  const tourPos = useRef(0);
  const attractPos = useRef(0);
  const wasUnattended = useRef(false);

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

  /**
   * Re-derive statuses as dates pass.
   *
   * `deriveStatus` turns an estimated completion date in the past into a
   * Complete (grey) pin, but it ran once at load — so on a display that
   * stays up for a month, a job that finished in week two kept showing as
   * In Progress until someone reloaded the page. Re-running it hourly
   * costs nothing and keeps the wall honest; the identity check means a
   * day where nothing crosses its date produces no re-render at all.
   */
  useEffect(() => {
    const id = window.setInterval(() => {
      setLiveProjects((prev) => {
        const next = prev.map((p) => deriveStatus(p));
        return next.some((p, i) => p !== prev[i]) ? next : prev;
      });
    }, 60 * 60 * 1000);
    return () => window.clearInterval(id);
  }, []);

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

  /**
   * What the screensaver rotates through.
   *
   * Only projects with photography qualify — the procedural drawings were
   * retired, so a project without photos has nothing to show. Featured
   * projects are the intent; any photographed project is the fallback,
   * because the one outcome to avoid is an empty rotation. That would
   * leave the same static map on the panel for the entire night, which is
   * both a wasted display and a burn-in risk, and it would fail silently:
   * before this, `featured.length > 0` was true while the attract loop's
   * own filtered list was empty, so it mounted and rendered nothing.
   */
  const attractProjects = useMemo(() => {
    // Every photographed project belongs in the screensaver, not just the
    // featured handful -- if a job was worth photographing it is worth
    // showing on the wall. Featured ones lead, so the rotation opens on
    // the curated set and then keeps going through the rest.
    const withPhotos = projects.filter((p) => (p.photos?.length ?? 0) > 0);
    return [
      ...withPhotos.filter((p) => p.featured),
      ...withPhotos.filter((p) => !p.featured)
    ];
  }, [projects]);
  const blakCount = useMemo(() => projects.filter(isBlak).length, [projects]);
  const historyCount = useMemo(() => projects.filter(isHistory).length, [projects]);
  const cityCount = useMemo(
    () => new Set(projects.map((p) => `${p.city}|${p.state}`)).size,
    [projects]
  );
  const cityOptions = useMemo(() => cityOptionsOf(projects), [projects]);

  const flyToBounds = useCallback((bounds: BBox) => {
    signalCounter.current += 1;
    setRegionSignal({ bounds, n: signalCounter.current });
  }, []);

  const select = useCallback((p: Project, opts?: { tour?: boolean }) => {
    const tour = opts?.tour === true;
    setSelectedId(p.id);
    const url = `#/project/${p.id}`;
    // A tour replaces rather than pushes: an unattended display steps
    // through hundreds of projects a day, and every one of those would
    // otherwise be a back-button entry piling up in a tab nobody reloads.
    if (tour) history.replaceState(null, '', url);
    else window.location.hash = url;
    signalCounter.current += 1;
    setFocusSignal({ id: p.id, n: signalCounter.current, tour });
  }, []);

  const close = useCallback(() => {
    setSelectedId(null);
    if (window.location.hash) {
      // Keep the query string. The kiosk is launched with ?overscan= and
      // ?dpr= baked into its URL, and dropping them here meant the first
      // visitor to open and close a project silently reverted the display
      // to un-inset, default-resolution rendering for the rest of the run.
      history.replaceState(
        null,
        '',
        window.location.pathname + window.location.search
      );
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

  /**
   * The tour route: every photographed project that survives the current
   * filters, ordered into short hops so the camera drives the valley
   * instead of ricocheting across it.
   */
  const route = useMemo(() => tourRoute(shownProjects), [shownProjects]);

  const touring =
    TOUR_ENABLED && bootGone && idleStage === 1 && route.length > 0;
  // Without the tour there is nothing to fill the first idle stage, so
  // the screensaver takes over at the earlier threshold instead of
  // leaving the wall on a frozen map for three extra minutes.
  const showAttract =
    bootGone &&
    idleStage >= (TOUR_ENABLED ? 2 : 1) &&
    attractProjects.length > 0;

  /**
   * Drive the tour. Each step opens the next project, which flies the
   * camera and starts its photographs playing; the orbit takes over once
   * the flight lands.
   *
   * `tourPos` survives between tours on purpose, so an emptying lobby
   * picks the route up where it left off rather than replaying the same
   * first dozen jobs every time.
   */
  useEffect(() => {
    if (!touring) return;
    let cancelled = false;
    let timer: number | undefined;

    const visit = () => {
      if (cancelled) return;
      const stop = route[tourPos.current % route.length];
      tourPos.current += 1;
      select(stop, { tour: true });

      // Warm the next stop's photographs during this one's dwell, so its
      // card opens on a picture rather than an empty frame.
      const next = route[tourPos.current % route.length];
      for (const src of next?.photos ?? []) {
        const img = new Image();
        img.decoding = 'async';
        img.src = src;
      }
      timer = window.setTimeout(visit, TOUR_STEP_MS);
    };

    // A beat before the first flight, so the tour eases in rather than
    // lurching the instant the threshold trips.
    timer = window.setTimeout(visit, 700);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [touring, route, select]);

  /**
   * The screensaver covers the map completely, but a card the tour left
   * open underneath keeps the cinematic orbit running — and the orbit
   * drives the camera every frame, so the GL map would render at full
   * rate all night behind an opaque overlay for nobody.
   */
  useEffect(() => {
    if (showAttract) setSelectedId(null);
  }, [showAttract]);

  /**
   * Somebody walked up. Hand the wall back: close whatever the tour left
   * open and return to the valley, so the first thing they touch is a
   * clean map and not the middle of a tour they did not start.
   */
  useEffect(() => {
    if (touring || showAttract) {
      wasUnattended.current = true;
      return;
    }
    if (!wasUnattended.current) return;
    wasUnattended.current = false;
    setSelectedId(null);
    if (window.location.hash) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    flyToBounds(REGIONS[0].bounds);
  }, [touring, showAttract, flyToBounds]);

  /**
   * Hand the wall back to the next visitor.
   *
   * Whatever the last person left open — a project card, a city filter, a
   * team highlight, the search sheet — used to stay that way for the rest
   * of the month, so the second visitor met the first visitor's session.
   * Going idle is the signal that they have walked away, so the display
   * returns to the view it boots with.
   *
   * This also ends the cinematic orbit. The orbit only runs while a detail
   * card is open, and closing the card stops it — which matters because
   * the orbit drives the camera every frame and would otherwise keep the
   * GL map rendering at full rate underneath the screensaver, all night,
   * for nothing.
   */
  useEffect(() => {
    if (!idle) return;
    setSelectedId(null);
    setSearchOpen(false);
    setFilters(EMPTY_FILTERS);
    setActiveTeams((prev) => (prev.size === 0 ? prev : new Set()));
    if (window.location.hash) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }, [idle]);

  /**
   * Pick up a new deploy without anyone restarting the display. The reload
   * is deferred until the kiosk goes idle, so it can never yank the screen
   * out from under someone who is reading a project.
   */
  const [updateReady, setUpdateReady] = useState(false);
  useEffect(() => watchForUpdates(() => setUpdateReady(true)), []);
  useEffect(() => {
    if (!updateReady || !idle) return;
    let cancelled = false;
    const t = window.setTimeout(async () => {
      // Confirm the origin is still answering first. Reloading into a dead
      // network replaces a working wall with the browser's own error page,
      // and unlike this app that page never retries. The update is not
      // urgent; it can wait for the next idle window.
      if (!cancelled && (await isReachable())) window.location.reload();
    }, 2000);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [updateReady, idle]);

  /**
   * Watch the frame rate and shed the expensive flourishes if this display
   * cannot hold a smooth one. A smart TV's own browser is a different
   * class of hardware from the PC this was tuned on.
   */
  useEffect(() => watchPerformance(), []);

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
    <div
      className={`app${selected ? ' detail-open' : ''}${idle ? ' is-idle' : ''}`}
    >
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
        onToggleDiag={() => setDiagOn((v) => !v)}
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
        historyCount={historyCount}
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

      <BlakBadge
        count={blakCount}
        active={activeTeams.has('blak')}
        onToggle={() => toggleTeam('blak')}
      />

      {searchOpen && (
        <SearchOverlay
          projects={projects}
          onSelect={select}
          onClose={() => setSearchOpen(false)}
        />
      )}

      {toast && <div className="toast">{toast}</div>}

      {diagOn && <DiagOverlay engine={useMapbox ? 'Mapbox' : 'MapLibre'} />}

      {touring && (
        <div className="tour-hint" aria-hidden="true">
          <span className="tour-hint-dot" />
          AUTO TOUR · TOUCH TO EXPLORE
        </div>
      )}

      {showAttract && (
        <IdleAttract featured={attractProjects} startAt={attractPos} />
      )}

      {!bootGone && <BootScreen leaving={bootDone} />}
    </div>
  );
}
