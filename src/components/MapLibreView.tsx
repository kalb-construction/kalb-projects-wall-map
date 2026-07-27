import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { Map as MLMap, Marker, StyleSpecification } from 'maplibre-gl';
import type { Project } from '../types';
import type { BBox } from '../lib/regions';

/**
 * Real-world map engine: MapLibre GL with a custom style built on the most
 * broadly reachable public tile sources — OpenStreetMap raster for the
 * street view, Esri World Imagery for the satellite view — plus best-effort
 * 3D building extrusions from OpenFreeMap vector tiles when reachable.
 * Tiles need internet; markers and UI still function without it.
 */

const MAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© OpenStreetMap contributors'
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
    }
  },
  layers: [
    {
      id: 'bg',
      type: 'background',
      paint: { 'background-color': '#e9e5dd' }
    },
    {
      id: 'base-streets',
      type: 'raster',
      source: 'osm',
      paint: { 'raster-saturation': -0.12, 'raster-contrast': 0.02 }
    },
    {
      id: 'base-satellite',
      type: 'raster',
      source: 'satellite',
      layout: { visibility: 'none' }
    },
    {
      id: 'base-satlabels',
      type: 'raster',
      source: 'satlabels',
      layout: { visibility: 'none' }
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
        'fill-extrusion-opacity': 0.82
      }
    }
  ]
};

const HOME = {
  center: [-115.155, 36.135] as [number, number],
  zoom: 10.6,
  pitch: 45,
  bearing: -12
};

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

export function MapLibreView({
  projects,
  visibleIds,
  selectedId,
  detailOpen,
  focusSignal,
  regionSignal,
  onSelect,
  onBackgroundTap,
  onLoaded
}: MapLibreViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const unitsRef = useRef<MarkerUnit[]>([]);
  const [sitePopup, setSitePopup] = useState<SiteGroup | null>(null);
  const [popupPos, setPopupPos] = useState<{ x: number; y: number } | null>(null);
  const [satellite, setSatellite] = useState(false);

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
      maxPitch: 68,
      canvasContextAttributes: { antialias: true },
      attributionControl: { compact: true }
    });
    mapRef.current = map;

    map.touchZoomRotate.enableRotation();
    map.dragRotate.enable();

    map.on('load', () => onLoadedRef.current());
    // Never let a failed tile/style fetch wedge the boot screen.
    map.on('error', () => onLoadedRef.current());

    map.on('click', () => {
      setSitePopup(null);
      onBackgroundTapRef.current();
    });

    const syncLabels = () =>
      container.classList.toggle('labels-on', map.getZoom() >= 12.6);
    map.on('zoom', syncLabels);
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
        'K',
        `${p.number} · ${p.shortName ?? p.name}`
      );
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
      units.forEach((u) => u.marker.remove());
      unitsRef.current = [];
      map.remove();
      mapRef.current = null;
    };
    // projects is static data — mount once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- keep the site popup glued to its anchor ---------------------------
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
  }, [sitePopup]);

  // ---- dim / selected state ----------------------------------------------
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
  }, [visibleIds, selectedId]);

  // ---- cinematic fly-to on selection --------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusSignal) return;
    const target = projects.find((p) => p.id === focusSignal.id);
    if (!target) return;
    setSitePopup(null);
    const w = map.getContainer().clientWidth;
    const panelW = detailOpenRef.current ? Math.min(680, w * 0.46) : 0;
    map.flyTo({
      center: [target.lng, target.lat],
      zoom: Math.max(map.getZoom(), 16.6),
      pitch: 58,
      bearing: map.getBearing() + 24,
      duration: 2400,
      offset: [-panelW / 2 + 30, -20],
      essential: true
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusSignal]);

  // ---- region quick-nav ----------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !regionSignal) return;
    setSitePopup(null);
    map.fitBounds(regionSignal.bounds, {
      padding: { top: 120, bottom: 190, left: 120, right: 90 },
      bearing: -12,
      duration: 2300,
      essential: true
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regionSignal]);

  const home = () => {
    setSitePopup(null);
    mapRef.current?.flyTo({ ...HOME, duration: 1800, essential: true });
  };

  const toggleSatellite = () => {
    const map = mapRef.current;
    if (!map) return;
    const next = !satellite;
    setSatellite(next);
    const vis = (on: boolean) => (on ? 'visible' : 'none');
    try {
      map.setLayoutProperty('base-streets', 'visibility', vis(!next));
      map.setLayoutProperty('base-satellite', 'visibility', vis(next));
      map.setLayoutProperty('base-satlabels', 'visibility', vis(next));
      map.setPaintProperty(
        'kalb-3d-buildings',
        'fill-extrusion-opacity',
        next ? 0.45 : 0.82
      );
    } catch {
      /* style not loaded yet */
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
            m.easeTo({ pitch: m.getPitch() > 25 ? 0 : 58, duration: 700 });
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
        <button className="ctl-btn ctl-home" aria-label="Reset view" onClick={home}>
          ⌂
        </button>
      </div>
    </div>
  );
}
