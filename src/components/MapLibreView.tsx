import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { Map as MLMap, Marker, StyleSpecification } from 'maplibre-gl';
import type { Project } from '../types';
import type { BBox } from '../lib/regions';
import { setBearing } from '../lib/bearing';
import { pinColor, pinGlyph, isBlak } from '../lib/brand';
import { toggleFullscreen, DPR_CAP } from '../lib/kiosk';
import { easeInOutCubic, tourFlightMs } from '../lib/tour';
import { isLite } from '../lib/perf';
import { watchGlContext, clearGlRecoveryBudget } from '../lib/glRecovery';
import { addHeatLayer } from '../lib/heat';

/**
 * Real-world map engine: MapLibre GL with a custom style built on the most
 * broadly reachable public tile sources — OpenStreetMap raster for the
 * street view, Esri World Imagery for the satellite view — plus best-effort
 * 3D building extrusions from OpenFreeMap vector tiles when reachable.
 * Tiles need internet; markers and UI still function without it.
 */

/**
 * Cinematic default: Esri World Imagery (photo-real satellite) with place
 * labels, globe projection + atmosphere when zoomed out. Alternate "MAP"
 * theme: CARTO Voyager (modern, minimal streets) layered OVER OpenStreetMap
 * — if the CARTO CDN is unreachable, OSM shows through as a fallback.
 * 3D building extrusions render best-effort from OpenFreeMap vector tiles.
 */
const MAP_STYLE = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© OpenStreetMap contributors'
    },
    voyager: {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
        'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
        'https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
        'https://d.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png'
      ],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© OpenStreetMap contributors © CARTO'
    },
    satellite: {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
      ],
      tileSize: 256,
      maxzoom: 19,
      attribution: 'Imagery © Esri, Maxar, Earthstar Geographics'
    },
    satlabels: {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'
      ],
      tileSize: 256,
      maxzoom: 19,
      attribution: 'Labels © Esri'
    },
    // Best-effort vector source for 3D buildings (skipped if unreachable).
    openmaptiles: {
      type: 'vector',
      url: 'https://tiles.openfreemap.org/planet'
    },
    // Free, keyless elevation tiles (AWS Open Data / Mapzen terrarium).
    // Two identical sources: MapLibre needs separate ones for 3D terrain
    // and for the hillshade layer.
    'terrain-dem': {
      type: 'raster-dem',
      tiles: [
        'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'
      ],
      encoding: 'terrarium',
      tileSize: 256,
      maxzoom: 12,
      attribution: 'Terrain: Mapzen/AWS Open Data'
    },
    'hillshade-dem': {
      type: 'raster-dem',
      tiles: [
        'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'
      ],
      encoding: 'terrarium',
      tileSize: 256,
      maxzoom: 12
    }
  },
  layers: [
    {
      id: 'bg',
      type: 'background',
      paint: { 'background-color': '#101418' }
    },
    {
      id: 'base-osm',
      type: 'raster',
      source: 'osm',
      paint: { 'raster-saturation': -0.15 }
    },
    {
      id: 'base-voyager',
      type: 'raster',
      source: 'voyager'
    },
    {
      id: 'terrain-hillshade',
      type: 'hillshade',
      source: 'hillshade-dem',
      paint: {
        'hillshade-shadow-color': 'rgba(66, 56, 44, 0.45)',
        'hillshade-highlight-color': 'rgba(255, 252, 244, 0.25)',
        'hillshade-exaggeration': 0.45
      }
    },
    {
      id: 'base-satellite',
      type: 'raster',
      source: 'satellite',
      layout: { visibility: 'none' },
      paint: { 'raster-saturation': 0.06, 'raster-contrast': 0.05 }
    },
    {
      id: 'base-satlabels',
      type: 'raster',
      source: 'satlabels',
      layout: { visibility: 'none' },
      paint: { 'raster-opacity': 0.9 }
    },
    {
      id: 'kalb-3d-buildings',
      type: 'fill-extrusion',
      source: 'openmaptiles',
      'source-layer': 'building',
      minzoom: 14,
      paint: {
        'fill-extrusion-color': '#d9d3c8',
        'fill-extrusion-height': [
          'coalesce',
          ['get', 'render_height'],
          ['get', 'height'],
          10
        ],
        'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
        'fill-extrusion-opacity': 0.85
      }
    }
  ]
} as unknown as StyleSpecification;

const HOME = {
  center: [-115.155, 36.135] as [number, number],
  zoom: 10.7,
  pitch: 0,
  bearing: 0
};

/** ?flat=1 disables 3D terrain for lower-powered hardware. */
const FLAT_MODE = new URLSearchParams(window.location.search).has('flat');

/**
 * Terrain is only enabled from this zoom in. Zoomed further out the DEM
 * mesh has to span enormous distances from sparse elevation tiles, which
 * is what tore the basemap into floating shards.
 */
const TERRAIN_MIN_ZOOM = 9.5;

/** Degrees per millisecond for the slow drone-orbit around a selection. */
const ORBIT_SPEED = 0.0008;

/**
 * Google Photorealistic 3D Tiles key. Set VITE_GOOGLE_MAPS_API_KEY in .env
 * (see .env.example), or pass ?gkey=YOUR_KEY in the URL for a quick test.
 */
const GOOGLE_KEY: string | null =
  new URLSearchParams(window.location.search).get('gkey') ||
  import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
  null;

/** deck.gl overlay handle (loaded on demand — heavy modules stay lazy). */
interface DeckOverlayLike {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setProps: (p: any) => void;
}
interface DeckHandle {
  overlay: DeckOverlayLike;
  makeLayer: () => unknown;
}

interface SiteGroup {
  siteId: string;
  siteName: string;
  lng: number;
  lat: number;
  members: Project[];
}

interface MarkerUnit {
  key: string;
  el: HTMLButtonElement;
  marker: Marker;
  project?: Project;
  site?: SiteGroup;
}

interface MapLibreViewProps {
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

export function MapLibreView({
  projects,
  visibleIds,
  selectedId,
  detailOpen,
  focusSignal,
  regionSignal,
  onSelect,
  onBackgroundTap,
  onLoaded,
  northSignal
}: MapLibreViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const unitsRef = useRef<MarkerUnit[]>([]);
  const [sitePopup, setSitePopup] = useState<SiteGroup | null>(null);
  const popupElRef = useRef<HTMLDivElement | null>(null);
  const [satellite, setSatellite] = useState(false);
  const [google3d, setGoogle3d] = useState(false);
  const [g3dError, setG3dError] = useState(false);
  const deckRef = useRef<DeckHandle | null>(null);
  const orbitRef = useRef<number | null>(null);

  /** True while Google's photoreal mesh owns elevation (suppress our DEM). */
  const google3dRef = useRef(false);
  const terrainOnRef = useRef(false);

  /**
   * Enable 3D terrain only when zoomed in past TERRAIN_MIN_ZOOM. Toggling
   * it with zoom (instead of leaving it always on) is what stops the
   * basemap from tearing into floating shards at city/state scale.
   */
  const syncTerrain = () => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded?.()) return;
    const want =
      !FLAT_MODE &&
      !google3dRef.current &&
      map.getZoom() >= TERRAIN_MIN_ZOOM;
    if (want === terrainOnRef.current) return;
    try {
      map.setTerrain(want ? { source: 'terrain-dem', exaggeration: 1.25 } : null);
      terrainOnRef.current = want;
    } catch {
      /* terrain unavailable — map stays flat */
    }
  };

  const stopOrbit = () => {
    if (orbitRef.current !== null) {
      cancelAnimationFrame(orbitRef.current);
      orbitRef.current = null;
    }
  };

  /** Slow cinematic orbit around the current center, movie drone style. */
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

  // Latest-callback refs so marker listeners never go stale.
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onBackgroundTapRef = useRef(onBackgroundTap);
  onBackgroundTapRef.current = onBackgroundTap;
  const onLoadedRef = useRef(onLoaded);
  onLoadedRef.current = onLoaded;
  const detailOpenRef = useRef(detailOpen);
  detailOpenRef.current = detailOpen;

  // ---- init map + markers (once) ----------------------------------------
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const map = new maplibregl.Map({
      container,
      style: MAP_STYLE,
      center: HOME.center,
      zoom: HOME.zoom,
      pitch: HOME.pitch,
      bearing: HOME.bearing,
      maxPitch: 60,
      minZoom: 3,
      pixelRatio: Math.min(window.devicePixelRatio || 1, DPR_CAP),
      // maxTileCacheSize is deliberately NOT set. MapLibre documents it as
      // a cap "for a given source", and this style declares seven, so the
      // 2048 that used to be here meant a ceiling of ~14k retained tiles —
      // the shape of a display that is fine for three weeks and then dies.
      // The default sizes the cache from the viewport instead, which on a
      // 4K wall is generous on its own and bounded by definition.
      refreshExpiredTiles: false,
      fadeDuration: 0,
      canvasContextAttributes: { antialias: false },
      attributionControl: false
    });
    mapRef.current = map;

    map.touchZoomRotate.enableRotation();
    map.dragRotate.enable();

    map.on('load', () => {
      syncTerrain();
      clearGlRecoveryBudget();
      onLoadedRef.current();
    });
    // A lost GL context leaves the markers and chrome floating over a black
    // canvas, which looks broken rather than busy. Recover by reloading.
    const detachGl = watchGlContext(map.getCanvas());
    // The activity glow rides on 'styledata', not 'load': 'load' waits for
    // tiles, so an unreachable tile host would silently keep the glow off.
    // addHeatLayer is idempotent, so repeat firings are free.
    const tryHeat = () => addHeatLayer(map, projects);
    map.on('styledata', tryHeat);
    tryHeat();
    // Diagnostics handle (used by ?diag tooling and headless checks).
    (window as unknown as { __atlasMap?: unknown }).__atlasMap = map;
    // Never let a failed tile/style fetch wedge the boot screen.
    map.on('error', () => onLoadedRef.current());

    map.on('click', () => {
      setSitePopup(null);
      onBackgroundTapRef.current();
    });

    const onViewportChange = () => map.resize();
    window.addEventListener('resize', onViewportChange);
    document.addEventListener('fullscreenchange', onViewportChange);

    // Any manual gesture cancels the cinematic orbit.
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
    // camera with setBearing() once per frame, and each call emits its own
    // movestart/moveend pair — so toggling the class directly meant adding
    // and removing it 60 times a second, which is style recalculation over
    // every marker on every frame: the exact cost this class exists to
    // avoid. Holding it until the camera has been quiet briefly makes one
    // continuous motion read as one motion.
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
    map.on('zoom', syncTerrain);
    syncLabels();

    // ---- markers ----
    const { singles, sites } = groupProjects(projects);
    const units: MarkerUnit[] = [];

    const makeEl = (
      cls: string,
      head: string,
      label: string
    ): HTMLButtonElement => {
      const el = document.createElement('button');
      el.className = `km ${cls}`;
      el.innerHTML =
        '<span class="km-pulse"></span>' +
        `<span class="km-head">${head}</span>` +
        '<span class="km-tip"></span>' +
        `<span class="km-label">${label}</span>`;
      return el;
    };

    for (const p of singles) {
      const el = makeEl(
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
      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([p.lng, p.lat])
        .addTo(map);
      units.push({ key: p.id, el, marker, project: p });
    }

    for (const site of sites) {
      const el = makeEl(
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
      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([site.lng, site.lat])
        .addTo(map);
      units.push({ key: site.siteId, el, marker, site });
    }

    unitsRef.current = units;

    return () => {
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
    // projects is static data — mount once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- keep the site popup glued to its anchor ---------------------------
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
  }, [sitePopup]);

  // ---- dim / selected state ----------------------------------------------
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
  }, [visibleIds, selectedId]);

  // ---- cinematic fly-to on selection --------------------------------------
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
    // See MapboxView: a tour flies slower and arcs higher than a tap.
    const tour = focusSignal.tour === true;
    map.flyTo({
      center: [target.lng, target.lat],
      zoom: tour ? 16.2 : Math.max(map.getZoom(), 16.8),
      // Flat camera in lite mode: pitch is what puts 3D building
      // extrusions and a far horizon of extra tiles on screen.
      pitch: isLite() ? 0 : 55,
      bearing: map.getBearing() + (tour ? 22 : 30),
      duration: tour ? tourFlightMs(map.getCenter(), target) : 2600,
      ...(tour ? { curve: 1.62, easing: easeInOutCubic } : null),
      offset: [-panelW / 2 + 30, -20],
      essential: true
    });
    // Once the flight lands, begin the slow movie-drone orbit.
    map.once('moveend', () => {
      if (detailOpenRef.current) startOrbit();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusSignal]);

  // Detail closed → end the orbit.
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

  // ---- region quick-nav ----------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !regionSignal) return;
    setSitePopup(null);
    stopOrbit();
    map.fitBounds(regionSignal.bounds, {
      padding: { top: 120, bottom: 190, left: 120, right: 90 },
      bearing: 0,
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

  /**
   * Toggle Google Photorealistic 3D Tiles, lazily loading deck.gl the first
   * time. Rendered interleaved into MapLibre's WebGL context so DOM markers
   * and camera stay perfectly in sync.
   */
  const toggleGoogle3d = async () => {
    const map = mapRef.current;
    if (!map || !GOOGLE_KEY) return;
    const next = !google3d;
    setGoogle3d(next);
    setG3dError(false);

    try {
      let handle = deckRef.current;
      if (!handle) {
        const [{ MapboxOverlay }, { Tile3DLayer }, { Tiles3DLoader }] =
          await Promise.all([
            import('@deck.gl/mapbox'),
            import('@deck.gl/geo-layers'),
            import('@loaders.gl/3d-tiles')
          ]);
        const makeLayer = () =>
          new Tile3DLayer({
            id: 'google-3d-tiles',
            data: `https://tile.googleapis.com/v1/3dtiles/root.json?key=${GOOGLE_KEY}`,
            loader: Tiles3DLoader,
            onTileError: () => setG3dError(true)
          });
        const overlay = new MapboxOverlay({ interleaved: true, layers: [] });
        // MapboxOverlay implements maplibre's IControl.
        map.addControl(overlay as unknown as maplibregl.IControl);
        handle = { overlay: overlay as unknown as DeckOverlayLike, makeLayer };
        deckRef.current = handle;
      }
      handle.overlay.setProps({
        layers: next ? [handle.makeLayer()] : []
      });
      // Google's photorealistic mesh replaces our imagery, extrusions, and
      // DEM terrain (its mesh already includes real elevation).
      const vis = (on: boolean) => (on ? 'visible' : 'none');
      map.setLayoutProperty('base-satlabels', 'visibility', vis(!next));
      map.setPaintProperty(
        'kalb-3d-buildings',
        'fill-extrusion-opacity',
        next ? 0 : satellite ? 0.5 : 0.85
      );
      google3dRef.current = next;
      if (next) {
        try {
          map.setTerrain(null);
          terrainOnRef.current = false;
        } catch {
          /* terrain unavailable */
        }
      } else {
        syncTerrain();
      }
    } catch {
      setG3dError(true);
      setGoogle3d(false);
      google3dRef.current = false;
    }
  };

  const toggleSatellite = () => {
    const map = mapRef.current;
    if (!map) return;
    const next = !satellite;
    setSatellite(next);
    const vis = (on: boolean) => (on ? 'visible' : 'none');
    try {
      map.setLayoutProperty('base-osm', 'visibility', vis(!next));
      map.setLayoutProperty('base-voyager', 'visibility', vis(!next));
      map.setLayoutProperty('terrain-hillshade', 'visibility', vis(!next));
      map.setLayoutProperty('base-satellite', 'visibility', vis(next));
      map.setLayoutProperty('base-satlabels', 'visibility', vis(next));
      map.setPaintProperty(
        'kalb-3d-buildings',
        'fill-extrusion-opacity',
        next ? 0.5 : 0.85
      );
      // Streets view retires the photorealistic overlay.
      if (!next && google3d && deckRef.current) {
        deckRef.current.overlay.setProps({ layers: [] });
        setGoogle3d(false);
      }
    } catch {
      /* style not loaded yet */
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
              className={`site-pop-row${
                visibleIds.has(m.id) ? '' : ' is-dim'
              }`}
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
        <button
          className={`ctl-btn ctl-sat${satellite ? ' is-on' : ''}`}
          aria-label="Toggle satellite view"
          aria-pressed={satellite}
          onClick={toggleSatellite}
        >
          {satellite ? 'MAP' : 'SAT'}
        </button>
        {GOOGLE_KEY && (
          <button
            className={`ctl-btn ctl-sat${google3d ? ' is-on' : ''}`}
            aria-label="Toggle photorealistic 3D buildings"
            aria-pressed={google3d}
            onClick={toggleGoogle3d}
          >
            3D
          </button>
        )}
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

      {google3d && <div className="g-attrib">Map data © Google</div>}
      {g3dError && (
        <div className="g-error">
          3D tiles unavailable — check the Google API key / Map Tiles API
        </div>
      )}
    </div>
  );
}
