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

export const MAPBOX_TOKEN: string | null =
  new URLSearchParams(window.location.search).get('mtoken') ||
  import.meta.env.VITE_MAPBOX_TOKEN ||
  null;

const STYLE_STANDARD = 'mapbox://styles/mapbox/standard';
const STYLE_SATELLITE = 'mapbox://styles/mapbox/standard-satellite';

const HOME = {
  center: [-115.155, 36.135] as [number, number],
  zoom: 10.7,
  pitch: 47,
  bearing: -14
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
  onLoaded
}: MapboxViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const unitsRef = useRef<MarkerUnit[]>([]);
  const [ready, setReady] = useState(false);
  const [sitePopup, setSitePopup] = useState<SiteGroup | null>(null);
  const [popupPos, setPopupPos] = useState<{ x: number; y: number } | null>(null);
  const [lightIdx, setLightIdx] = useState(2); // default: dusk
  const [satellite, setSatellite] = useState(false);
  const orbitRef = useRef<number | null>(null);

  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onBackgroundTapRef = useRef(onBackgroundTap);
  onBackgroundTapRef.current = onBackgroundTap;
  const onLoadedRef = useRef(onLoaded);
  onLoadedRef.current = onLoaded;
  const detailOpenRef = useRef(detailOpen);
  detailOpenRef.current = detailOpen;
  const lightIdxRef = useRef(lightIdx);
  lightIdxRef.current = lightIdx;
  const satelliteRef = useRef(satellite);
  satelliteRef.current = satellite;

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
      await import('mapbox-gl/dist/mapbox-gl.css');
      if (cancelled) return;
      const mapboxgl = mod.default ?? mod;
      mapboxgl.accessToken = MAPBOX_TOKEN;

      const map = new mapboxgl.Map({
        container,
        style: STYLE_STANDARD,
        center: HOME.center,
        zoom: HOME.zoom,
        pitch: HOME.pitch,
        bearing: HOME.bearing,
        maxPitch: 60,
        antialias: true,
        attributionControl: true
      });
      mapRef.current = map;

      map.on('load', () => {
        applyLight(map, lightIdxRef.current);
        setReady(true);
        onLoadedRef.current();
      });
      // Re-apply lighting after any style swap (SAT toggle).
      map.on('style.load', () => {
        if (!satelliteRef.current) applyLight(map, lightIdxRef.current);
      });
      map.on('error', () => onLoadedRef.current());
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
      } else if (u.site) {
        const vis = u.site.members.filter((m) => visibleIds.has(m.id)).length;
        u.el.classList.toggle('is-dim', vis === 0);
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
    const panelW = detailOpenRef.current ? Math.min(680, w * 0.46) : 0;
    map.flyTo({
      center: [target.lng, target.lat],
      zoom: Math.max(map.getZoom(), 16.8),
      pitch: 55,
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
    mapRef.current?.flyTo({ ...HOME, duration: 1800, essential: true });
  };

  const cycleLight = () => {
    const map = mapRef.current;
    const next = (lightIdx + 1) % LIGHT_PRESETS.length;
    setLightIdx(next);
    if (map) applyLight(map, next);
  };

  const toggleSatellite = () => {
    const map = mapRef.current;
    if (!map) return;
    const next = !satellite;
    setSatellite(next);
    map.setStyle(next ? STYLE_SATELLITE : STYLE_STANDARD);
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
        {!satellite && (
          <button
            className="ctl-btn ctl-sat"
            aria-label="Cycle lighting (dawn, day, dusk, night)"
            onClick={cycleLight}
          >
            {LIGHT_PRESETS[lightIdx].toUpperCase()}
          </button>
        )}
        <button
          className={`ctl-btn ctl-sat${satellite ? ' is-on' : ''}`}
          aria-label="Toggle satellite view"
          aria-pressed={satellite}
          onClick={toggleSatellite}
        >
          {satellite ? 'MAP' : 'SAT'}
        </button>
        <button className="ctl-btn ctl-home" aria-label="Reset view" onClick={home}>
          ⌂
        </button>
      </div>
    </div>
  );
}
