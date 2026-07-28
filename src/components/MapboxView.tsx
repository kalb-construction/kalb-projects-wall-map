import { useEffect, useRef, useState } from 'react';
import type { Project } from '../types';
import type { BBox } from '../lib/regions';

/**
 * Premium engine: Mapbox GL JS v3 with the "Standard" style — live vector
 * rendering, automatic 3D buildings, globe + atmosphere, and cinematic
 * lighting presets (dawn/day/dusk/night). Activated only when a Mapbox
 * token is configured (VITE_MAPBOX_TOKEN in .env, or ?mtoken= in the URL);
 * otherwise the app runs the keyless MapLibre engine.
 *
 * mapbox-gl is dynamically imported so the base bundle stays lean.
 */

/** Trim stray quotes/whitespace/BOM that .env files on Windows pick up. */
function cleanKey(v: string | undefined | null): string | null {
  const s = (v ?? '').replace(/^﻿/, '').trim().replace(/^['"]|['"]$/g, '');
  return s.length > 0 ? s : null;
}

export const MAPBOX_TOKEN: string | null =
  cleanKey(new URLSearchParams(window.location.search).get('mtoken')) ??
  cleanKey(import.meta.env.VITE_MAPBOX_TOKEN);

/**
 * Three view modes, cycled by one control button:
 *   MAP — clean light street map (default; the calm "atlas" background)
 *   3D  — Mapbox Standard: live 3D city with dawn/day/dusk/night lighting
 *   SAT — satellite imagery
 */
const STYLES = {
  streets: 'mapbox://styles/mapbox/streets-v12',
  city3d: 'mapbox://styles/mapbox/standard',
  satellite: 'mapbox://styles/mapbox/standard-satellite'
} as const;

type ViewMode = keyof typeof STYLES;
const VIEW_ORDER: ViewMode[] = ['streets', 'city3d', 'satellite'];
const VIEW_LABEL: Record<ViewMode, string> = {
  streets: 'MAP',
  city3d: '3D',
  satellite: 'SAT'
};
/** Resting camera tilt per mode — flat for the clean map, raked for 3D. */
const VIEW_PITCH: Record<ViewMode, number> = {
  streets: 0,
  city3d: 50,
  satellite: 40
};

const HOME = {
  center: [-115.155, 36.135] as [number, number],
  zoom: 10.7,
  pitch: 0,
  bearing: 0
};

const LIGHT_PRESETS = ['dawn', 'day', 'dusk', 'night'] as const;
const ORBIT_SPEED = 0.0008;

interface SiteGroup {
  siteId: string;
  siteName: string;
  lng: number;
  lat: number;
  members: Project[];
}

/* eslint-disable @typescript-eslint/no-explicit-any */
interface MarkerUnit {
  key: string;
  el: HTMLButtonElement;
  marker: any;
  project?: Project;
  site?: SiteGroup;
}

interface MapboxViewProps {
  projects: Project[];
  visibleIds: Set<string>;
  selectedId: string | null;
  detailOpen: boolean;
  focusSignal: { id: string; n: number } | null;
  regionSignal: { bounds: BBox; n: number } | null;
  onSelect: (p: Project) => void;
  onBackgroundTap: () => void;
  onLoaded: () => void;
  /** projectId -> team color, applied to each marker as --km-color. */
  teamColors?: Record<string, string>;
  /** Called once if Mapbox can't render (bad token, blocked host, …). */
  onFailure?: (reason: string) => void;
}

function groupProjects(projects: Project[]): {
  singles: Project[];
  sites: SiteGroup[];
} {
  const singles: Project[] = [];
  const siteMap = new Map<string, SiteGroup>();
  for (const p of projects) {
    if (!p.siteId) {
      singles.push(p);
      continue;
    }
    let g = siteMap.get(p.siteId);
    if (!g) {
      g = {
        siteId: p.siteId,
        siteName: p.siteName ?? p.name,
        lng: p.lng,
        lat: p.lat,
        members: []
      };
      siteMap.set(p.siteId, g);
    }
    g.members.push(p);
  }
  return { singles, sites: [...siteMap.values()] };
}

function makeMarkerEl(
  cls: string,
  head: string,
  label: string
): HTMLButtonElement {
  const el = document.createElement('button');
  el.className = `km ${cls}`;
  el.innerHTML =
    '<span class="km-pulse"></span>' +
    `<span class="km-head">${head}</span>` +
    '<span class="km-tip"></span>' +
    `<span class="km-label">${label}</span>`;
  return el;
}

export function MapboxView({
  projects,
  visibleIds,
  selectedId,
  detailOpen,
  focusSignal,
  regionSignal,
  onSelect,
  onBackgroundTap,
  onLoaded,
  teamColors,
  onFailure
}: MapboxViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const unitsRef = useRef<MarkerUnit[]>([]);
  const [ready, setReady] = useState(false);
  const [sitePopup, setSitePopup] = useState<SiteGroup | null>(null);
  const [popupPos, setPopupPos] = useState<{ x: number; y: number } | null>(null);
  const [lightIdx, setLightIdx] = useState(2); // default: dusk
  const [view, setView] = useState<ViewMode>('streets');
  const orbitRef = useRef<number | null>(null);

  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onBackgroundTapRef = useRef(onBackgroundTap);
  onBackgroundTapRef.current = onBackgroundTap;
  const onLoadedRef = useRef(onLoaded);
  onLoadedRef.current = onLoaded;
  const onFailureRef = useRef(onFailure);
  onFailureRef.current = onFailure;
  const failedRef = useRef(false);
  const styleOkRef = useRef(false);

  /** Report an unrecoverable Mapbox problem exactly once. */
  const fail = (reason: string) => {
    if (failedRef.current) return;
    failedRef.current = true;
    console.error('[Kalb Atlas] Mapbox engine failed:', reason);
    onFailureRef.current?.(reason);
  };
  const detailOpenRef = useRef(detailOpen);
  detailOpenRef.current = detailOpen;
  const lightIdxRef = useRef(lightIdx);
  lightIdxRef.current = lightIdx;
  const viewRef = useRef(view);
  viewRef.current = view;

  const stopOrbit = () => {
    if (orbitRef.current !== null) {
      cancelAnimationFrame(orbitRef.current);
      orbitRef.current = null;
    }
  };

  const startOrbit = () => {
    stopOrbit();
    let last = performance.now();
    const tick = (now: number) => {
      const map = mapRef.current;
      if (!map) return;
      map.setBearing(map.getBearing() + (now - last) * ORBIT_SPEED);
      last = now;
      orbitRef.current = requestAnimationFrame(tick);
    };
    orbitRef.current = requestAnimationFrame(tick);
  };

  const applyLight = (map: any, idx: number) => {
    try {
      map.setConfigProperty('basemap', 'lightPreset', LIGHT_PRESETS[idx]);
    } catch {
      /* style may not support config yet */
    }
  };

  // ---- init (async: mapbox-gl is lazy-loaded) ----------------------------
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !MAPBOX_TOKEN) return;
    let cancelled = false;
    let cleanup: (() => void) | null = null;

    (async () => {
      const mod: any = await import('mapbox-gl');
      if (cancelled) return;
      const mapboxgl = mod.default ?? mod;
      try {
        mapboxgl.accessToken = MAPBOX_TOKEN;
      } catch {
        fail('could not set the Mapbox access token');
        return;
      }

      const map = new mapboxgl.Map({
        container,
        style: STYLES[viewRef.current],
        center: HOME.center,
        zoom: HOME.zoom,
        pitch: HOME.pitch,
        bearing: HOME.bearing,
        maxPitch: 60,
        antialias: true,
        attributionControl: false
      });
      mapRef.current = map;

      map.on('load', () => {
        setReady(true);
        onLoadedRef.current();
      });
      // Lighting presets exist only on the Standard (3D) style.
      map.on('style.load', () => {
        styleOkRef.current = true;
        if (viewRef.current === 'city3d') applyLight(map, lightIdxRef.current);
      });
      map.on('error', (e: any) => {
        const msg = String(
          e?.error?.message ?? e?.error?.status ?? e?.message ?? 'unknown error'
        );
        // Auth/quota/blocked-host problems mean the map can never draw.
        if (/401|403|unauthorized|forbidden|access token|not authorized/i.test(msg)) {
          fail(msg);
        }
        onLoadedRef.current();
      });

      // Watchdog: if the style never loads (blocked host, dead token),
      // hand off to the keyless engine instead of showing a blank wall.
      window.setTimeout(() => {
        if (!styleOkRef.current) fail('Mapbox style did not load in time');
      }, 9000);
      map.on('click', () => {
        setSitePopup(null);
        onBackgroundTapRef.current();
      });

      const cancelOrbit = () => stopOrbit();
      container.addEventListener('pointerdown', cancelOrbit, { capture: true });
      container.addEventListener('wheel', cancelOrbit, {
        capture: true,
        passive: true
      });

      const syncLabels = () =>
        container.classList.toggle('labels-on', map.getZoom() >= 12.6);
      map.on('zoom', syncLabels);
      // While the camera moves, freeze marker animations/transitions so
      // the only per-frame work is the map itself.
      const setMoving = (on: boolean) =>
        container.classList.toggle('is-moving', on);
      map.on('movestart', () => setMoving(true));
      map.on('moveend', () => setMoving(false));
      map.on('zoomstart', () => setMoving(true));
      map.on('zoomend', () => setMoving(false));
      syncLabels();

      const { singles, sites } = groupProjects(projects);
      const units: MarkerUnit[] = [];

      for (const p of singles) {
        const el = makeMarkerEl(
          p.featured ? 'km-single km-feat' : 'km-single',
          'K',
          `${p.number} · ${p.shortName ?? p.name}`
        );
        el.setAttribute('aria-label', `${p.number} ${p.name}`);
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          setSitePopup(null);
          onSelectRef.current(p);
        });
        const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([p.lng, p.lat])
          .addTo(map);
        units.push({ key: p.id, el, marker, project: p });
      }

      for (const site of sites) {
        const el = makeMarkerEl(
          'km-site',
          String(site.members.length),
          site.siteName.toUpperCase()
        );
        el.setAttribute(
          'aria-label',
          `${site.siteName}, ${site.members.length} projects`
        );
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          stopOrbit();
          map.flyTo({
            center: [site.lng, site.lat],
            zoom: Math.max(map.getZoom(), 15.6),
            pitch: 52,
            duration: 1400,
            offset: [0, 40]
          });
          setSitePopup(site);
        });
        const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([site.lng, site.lat])
          .addTo(map);
        units.push({ key: site.siteId, el, marker, site });
      }

      unitsRef.current = units;

      cleanup = () => {
        stopOrbit();
        container.removeEventListener('pointerdown', cancelOrbit, {
          capture: true
        } as EventListenerOptions);
        container.removeEventListener('wheel', cancelOrbit, {
          capture: true
        } as EventListenerOptions);
        units.forEach((u) => u.marker.remove());
        unitsRef.current = [];
        map.remove();
        mapRef.current = null;
      };
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- site popup tracking -------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !sitePopup) {
      setPopupPos(null);
      return;
    }
    const update = () => {
      const pt = map.project([sitePopup.lng, sitePopup.lat]);
      setPopupPos({ x: pt.x, y: pt.y });
    };
    update();
    map.on('move', update);
    return () => {
      map.off('move', update);
    };
  }, [sitePopup, ready]);

  // ---- dim / selected ------------------------------------------------------
  useEffect(() => {
    for (const u of unitsRef.current) {
      if (u.project) {
        u.el.classList.toggle('is-dim', !visibleIds.has(u.project.id));
        u.el.classList.toggle('is-selected', u.project.id === selectedId);
        const c = teamColors?.[u.project.id];
        if (c) u.el.style.setProperty('--km-color', c);
      } else if (u.site) {
        const vis = u.site.members.filter((m) => visibleIds.has(m.id)).length;
        u.el.classList.toggle('is-dim', vis === 0);
        u.el.classList.toggle(
          'is-selected',
          u.site.members.some((m) => m.id === selectedId)
        );
        const head = u.el.querySelector('.km-head');
        if (head) head.textContent = String(vis > 0 ? vis : u.site.members.length);
        const c = teamColors?.[u.site.members[0].id];
        if (c) u.el.style.setProperty('--km-color', c);
      }
    }
  }, [visibleIds, selectedId, ready, teamColors]);

  // ---- cinematic fly-to + orbit --------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusSignal) return;
    const target = projects.find((p) => p.id === focusSignal.id);
    if (!target) return;
    setSitePopup(null);
    stopOrbit();
    const w = map.getContainer().clientWidth;
    // Detail panel (when open) or the project index rail occupies the
    // right side — bias the camera so the pin lands clear of it.
    const panelW = detailOpenRef.current
      ? Math.min(680, w * 0.46)
      : w > 1500
        ? 360
        : 300;
    map.flyTo({
      center: [target.lng, target.lat],
      zoom: Math.max(map.getZoom(), 16.8),
      pitch: viewRef.current === 'streets' ? 35 : 55,
      bearing: map.getBearing() + 30,
      duration: 2600,
      offset: [-panelW / 2 + 30, -20],
      essential: true
    });
    map.once('moveend', () => {
      if (detailOpenRef.current) startOrbit();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusSignal]);

  useEffect(() => {
    if (!detailOpen) stopOrbit();
  }, [detailOpen]);

  // ---- region quick-nav ------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !regionSignal) return;
    setSitePopup(null);
    stopOrbit();
    map.fitBounds(regionSignal.bounds, {
      padding: { top: 120, bottom: 190, left: 120, right: 90 },
      bearing: -14,
      duration: 2300,
      essential: true
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regionSignal]);

  const home = () => {
    setSitePopup(null);
    stopOrbit();
    mapRef.current?.flyTo({
      ...HOME,
      pitch: VIEW_PITCH[viewRef.current],
      duration: 1800,
      essential: true
    });
  };

  const cycleLight = () => {
    const map = mapRef.current;
    const next = (lightIdx + 1) % LIGHT_PRESETS.length;
    setLightIdx(next);
    if (map) applyLight(map, next);
  };

  const cycleView = () => {
    const map = mapRef.current;
    if (!map) return;
    const next = VIEW_ORDER[(VIEW_ORDER.indexOf(view) + 1) % VIEW_ORDER.length];
    setView(next);
    viewRef.current = next;
    map.setStyle(STYLES[next]);
    // Settle the camera at the tilt that suits the new mode, unless the
    // user is already flown into a project.
    if (!detailOpenRef.current) {
      map.easeTo({ pitch: VIEW_PITCH[next], duration: 900 });
    }
  };

  return (
    <div className="map-shell">
      <div ref={containerRef} className="map-stage" />

      {sitePopup && popupPos && (
        <div
          className="site-pop"
          style={{ left: popupPos.x, top: popupPos.y }}
          role="menu"
          aria-label={`${sitePopup.siteName} projects`}
        >
          <div className="site-pop-head">
            <span className="site-pop-title">{sitePopup.siteName}</span>
            <span className="site-pop-count">
              {sitePopup.members.length} projects
            </span>
          </div>
          {sitePopup.members.map((m) => (
            <button
              key={m.id}
              className={`site-pop-row${visibleIds.has(m.id) ? '' : ' is-dim'}`}
              onClick={(e) => {
                e.stopPropagation();
                setSitePopup(null);
                onSelectRef.current(m);
              }}
            >
              <span className="sr-number">{m.number}</span>
              <span className="site-pop-name">{m.shortName ?? m.name}</span>
            </button>
          ))}
        </div>
      )}

      <div className="map-controls" role="group" aria-label="Map controls">
        <button
          className="ctl-btn"
          aria-label="Zoom in"
          onClick={() => mapRef.current?.zoomIn({ duration: 350 })}
        >
          +
        </button>
        <button
          className="ctl-btn"
          aria-label="Zoom out"
          onClick={() => mapRef.current?.zoomOut({ duration: 350 })}
        >
          −
        </button>
        <button
          className="ctl-btn"
          aria-label="Tilt view"
          onClick={() => {
            const m = mapRef.current;
            if (!m) return;
            m.easeTo({ pitch: m.getPitch() > 25 ? 0 : 55, duration: 700 });
          }}
        >
          ⬒
        </button>
        {view === 'city3d' && (
          <button
            className="ctl-btn ctl-sat"
            aria-label="Cycle lighting (dawn, day, dusk, night)"
            onClick={cycleLight}
          >
            {LIGHT_PRESETS[lightIdx].toUpperCase()}
          </button>
        )}
        <button
          className={`ctl-btn ctl-sat${view !== 'streets' ? ' is-on' : ''}`}
          aria-label={`Map view: ${VIEW_LABEL[view]} — tap to change`}
          onClick={cycleView}
        >
          {VIEW_LABEL[view]}
        </button>
        <button className="ctl-btn ctl-home" aria-label="Reset view" onClick={home}>
          ⌂
        </button>
      </div>
    </div>
  );
}
