import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Project } from '../types';
import type { BBox } from '../lib/regions';
import { setBearing } from '../lib/bearing';
import { pinColor, pinGlyph, isBlak } from '../lib/brand';
import { toggleFullscreen } from '../lib/kiosk';
import { easeInOutCubic, tourFlightMs } from '../lib/tour';
import { isLite } from '../lib/perf';
import { watchGlContext, clearGlRecoveryBudget } from '../lib/glRecovery';
import { clampDevicePixelRatio } from '../lib/dpr';
import { addHeatLayer } from '../lib/heat';

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
  focusSignal: { id: string; n: number; tour?: boolean } | null;
  regionSignal: { bounds: BBox; n: number } | null;
  onSelect: (p: Project) => void;
  onBackgroundTap: () => void;
  onLoaded: () => void;
  /** Bump to snap the camera back to north-up. */
  northSignal?: number;
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
  northSignal,
  onFailure
}: MapboxViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const unitsRef = useRef<MarkerUnit[]>([]);
  const [ready, setReady] = useState(false);
  const [sitePopup, setSitePopup] = useState<SiteGroup | null>(null);
  const popupElRef = useRef<HTMLDivElement | null>(null);
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
    // The orbit re-renders the entire map every frame. On a display that
    // already cannot hold 60, it is the first thing to go.
    if (isLite()) return;
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
    let detachGl: () => void = () => {};

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

      // Same 1.5 render-resolution cap the MapLibre engine has. Mapbox has
      // no pixelRatio option — it reads window.devicePixelRatio per frame —
      // so the property itself is clamped before the map is constructed.
      // Without this a hi-DPI wall renders ~1.8× the pixels and wheel-zoom
      // degrades into stretched-frame blur.
      clampDevicePixelRatio();

      const map = new mapboxgl.Map({
        container,
        style: STYLES[viewRef.current],
        center: HOME.center,
        zoom: HOME.zoom,
        pitch: HOME.pitch,
        bearing: HOME.bearing,
        maxPitch: isLite() ? 0 : 58,
        // Mapbox v3 switches to a globe when zoomed out, which draws an
        // atmosphere, a starfield and curved-earth geometry on top of the
        // map itself. It is the single most expensive thing this app can
        // put on screen, and on a TV's GPU it is the difference between a
        // slideshow and a map. Flat earth for weak displays.
        projection: isLite() ? 'mercator' : undefined,
        // MSAA is costly on a large display and buys little at this scale.
        antialias: false,
        // No label cross-fade: fewer full-frame repaints while panning.
        fadeDuration: 0,
        // No per-frame telemetry collection on a kiosk.
        performanceMetricsCollection: false,
        attributionControl: false
      });
      mapRef.current = map;
      // Diagnostics handle (used by ?diag tooling and headless checks).
      (window as unknown as { __atlasMap?: unknown }).__atlasMap = map;

      map.on('load', () => {
        setReady(true);
        clearGlRecoveryBudget();
        onLoadedRef.current();
      });
      // A lost GL context leaves the markers and chrome floating over a
      // black canvas, which looks broken rather than busy. Recover by
      // reloading.
      detachGl = watchGlContext(map.getCanvas());
      // Lighting presets exist only on the Standard (3D) style.
      // style.load also re-fires after every setStyle (view switch), which
      // wipes custom layers — so the activity glow is re-added here.
      map.on('style.load', () => {
        styleOkRef.current = true;
        if (viewRef.current === 'city3d') applyLight(map, lightIdxRef.current);
      });
      // Glow on 'styledata' (fires on initial style AND after every
      // setStyle, before tiles settle); addHeatLayer is idempotent.
      map.on('styledata', () => addHeatLayer(map, projects));
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

      // Entering/leaving fullscreen resizes the viewport; the GL canvas
      // must be told or it stays at the old size.
      const onViewportChange = () => map.resize();
      window.addEventListener('resize', onViewportChange);
      document.addEventListener('fullscreenchange', onViewportChange);

      const cancelOrbit = () => stopOrbit();
      // Legacy mouse/touch too: a TV browser fires no pointer events, and
      // an orbit that ignores the user fights every drag they attempt.
      const ORBIT_CANCEL = ['pointerdown', 'mousedown', 'touchstart'] as const;
      for (const ev of ORBIT_CANCEL) {
        container.addEventListener(ev, cancelOrbit, { capture: true });
      }
      container.addEventListener('wheel', cancelOrbit, {
        capture: true,
        passive: true
      });

      const syncLabels = () =>
        container.classList.toggle('labels-on', map.getZoom() >= 12.6);
      map.on('zoom', syncLabels);
      // While the camera moves, freeze marker animations/transitions so
      // the only per-frame work is the map itself.
      //
      // "Stopped" is debounced on purpose. The cinematic orbit drives the
      // camera with setBearing() once per frame, and each call emits its
      // own movestart/moveend pair — so toggling the class directly meant
      // adding and removing it 60 times a second, which is style
      // recalculation over every marker on every frame: the exact cost
      // this class exists to avoid. Holding it until the camera has been
      // quiet briefly makes one continuous motion read as one motion.
      let stopTimer: number | undefined;
      const setMoving = (on: boolean) => {
        window.clearTimeout(stopTimer);
        if (on) {
          if (!container.classList.contains('is-moving')) {
            container.classList.add('is-moving');
          }
          return;
        }
        stopTimer = window.setTimeout(
          () => container.classList.remove('is-moving'),
          120
        );
      };
      map.on('movestart', () => setMoving(true));
      map.on('moveend', () => setMoving(false));
      map.on('zoomstart', () => setMoving(true));
      map.on('zoomend', () => setMoving(false));

      // Compass feed: throttled so a spinning camera can't flood React.
      let lastBearingAt = 0;
      const emitBearing = () => {
        const now = performance.now();
        if (now - lastBearingAt < 90) return;
        lastBearingAt = now;
        setBearing(map.getBearing());
      };
      map.on('rotate', emitBearing);
      map.on('moveend', () => setBearing(map.getBearing()));
      syncLabels();

      const { singles, sites } = groupProjects(projects);
      const units: MarkerUnit[] = [];

      for (const p of singles) {
        const el = makeMarkerEl(
          p.featured ? 'km-single km-feat' : 'km-single',
          pinGlyph(p),
          isBlak(p)
            ? (p.shortName ?? p.name)
            : `${p.number} · ${p.shortName ?? p.name}`
        );
        el.style.setProperty('--km-color', pinColor(p));
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
        detachGl();
        window.clearTimeout(stopTimer);
        window.removeEventListener('resize', onViewportChange);
        document.removeEventListener('fullscreenchange', onViewportChange);
        for (const ev of ORBIT_CANCEL) {
          container.removeEventListener(ev, cancelOrbit, {
            capture: true
          } as EventListenerOptions);
        }
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
  // Position is written straight to the DOM: a `setState` here would
  // re-render React on every frame of camera motion while a popup is open.
  // Layout-timed so the popup never paints un-positioned at 0,0.
  useLayoutEffect(() => {
    const map = mapRef.current;
    if (!map || !sitePopup) return;
    const update = () => {
      const el = popupElRef.current;
      if (!el) return;
      const pt = map.project([sitePopup.lng, sitePopup.lat]);
      el.style.transform = `translate(${pt.x}px, ${pt.y}px) translate(-50%, 18px)`;
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
        u.el.classList.toggle('is-hidden', !visibleIds.has(u.project.id));
        u.el.classList.toggle('is-selected', u.project.id === selectedId);
      } else if (u.site) {
        const vis = u.site.members.filter((m) => visibleIds.has(m.id)).length;
        u.el.classList.toggle('is-hidden', vis === 0);
        u.el.classList.toggle(
          'is-selected',
          u.site.members.some((m) => m.id === selectedId)
        );
        const head = u.el.querySelector('.km-head');
        if (head) head.textContent = String(vis > 0 ? vis : u.site.members.length);
      }
    }
  }, [visibleIds, selectedId, ready]);

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
    // An unattended tour flies slower and arcs higher than a tap does. A
    // tap is a response and should feel immediate; a tour is the wall
    // showing off to a room, and wants the long lens.
    const tour = focusSignal.tour === true;
    map.flyTo({
      center: [target.lng, target.lat],
      // A tap never zooms out from wherever you were. A tour settles on
      // one altitude for every stop, so a route that crosses the valley
      // does not creep tighter with each hop.
      zoom: tour ? 16.2 : Math.max(map.getZoom(), 16.8),
      // Flat camera in lite mode: pitch is what puts 3D building
      // extrusions and a far horizon of extra tiles on screen.
      pitch: isLite() ? 0 : viewRef.current === 'streets' ? 35 : 55,
      bearing: map.getBearing() + (tour ? 22 : 30),
      duration: tour ? tourFlightMs(map.getCenter(), target) : 2600,
      // Higher curve pulls the camera up and out mid-flight, so the hop
      // reads as travel across the city rather than a cut.
      ...(tour ? { curve: 1.62, easing: easeInOutCubic } : null),
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

  // ---- compass: snap back to north-up ------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !northSignal) return;
    stopOrbit();
    map.easeTo({ bearing: 0, duration: 700 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [northSignal]);

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

      {sitePopup && (
        <div
          ref={popupElRef}
          className="site-pop"
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
        <button
          className="ctl-btn ctl-full"
          aria-label="Toggle full screen"
          title="Full screen"
          onClick={() => void toggleFullscreen()}
        >
          <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
            <path
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"
            />
          </svg>
        </button>
        <button className="ctl-btn ctl-home" aria-label="Reset view" onClick={home}>
          ⌂
        </button>
      </div>
    </div>
  );
}
