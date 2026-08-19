import type { Project } from '../types';
import { isLite } from './perf';

/**
 * "Activity glow" — a soft Kalb-red density layer under the markers,
 * brighter where active jobs concentrate. It is computed from the real
 * pins (no invented boundaries or territory polygons) and only Complete
 * jobs are excluded: the glow marks where Kalb is actively working.
 *
 * Zoom behaviour: visible at valley/state scale, fully faded by z13.5 so
 * it never competes with pins and buildings at street level. GPU-native
 * heatmap layer in both engines — no per-frame CPU or React work.
 */

export const HEAT_SOURCE = 'kalb-activity';
export const HEAT_LAYER = 'kalb-activity-glow';

export function heatSourceData(projects: Project[]) {
  return {
    type: 'FeatureCollection' as const,
    features: projects
      .filter((p) => p.status !== 'Complete')
      .map((p) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] },
        properties: {}
      }))
  };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function heatLayerSpec(): any {
  return {
    id: HEAT_LAYER,
    type: 'heatmap',
    source: HEAT_SOURCE,
    maxzoom: 14,
    paint: {
      'heatmap-weight': 1,
      'heatmap-intensity': [
        'interpolate', ['linear'], ['zoom'],
        6, 0.55,
        13, 1.3
      ],
      'heatmap-radius': [
        'interpolate', ['linear'], ['zoom'],
        6, 14,
        10, 32,
        13, 58
      ],
      // Kalb-red ember ramp, translucent throughout — the basemap must
      // stay readable underneath (see MASTER_PROMPT non-negotiables).
      'heatmap-color': [
        'interpolate', ['linear'], ['heatmap-density'],
        0, 'rgba(193, 0, 22, 0)',
        0.35, 'rgba(193, 0, 22, 0.10)',
        0.7, 'rgba(193, 0, 22, 0.22)',
        1, 'rgba(230, 60, 70, 0.34)'
      ],
      'heatmap-opacity': [
        'interpolate', ['linear'], ['zoom'],
        11.5, 0.85,
        13.5, 0
      ]
    }
  };
}

/** Add (or re-add after a style switch) the glow to a Mapbox/MapLibre map. */
export function addHeatLayer(map: any, projects: Project[]): void {
  // One more full-screen blended pass per frame; a weak GPU cannot
  // spare it, and the layer is decoration.
  if (isLite()) return;
  try {
    if (map.getSource(HEAT_SOURCE)) return;
    map.addSource(HEAT_SOURCE, {
      type: 'geojson',
      data: heatSourceData(projects)
    });
    // Under the basemap's text so labels stay crisp; on styles without
    // symbol layers it simply goes on top of the rasters.
    const firstSymbol = map
      .getStyle()
      ?.layers?.find((l: any) => l.type === 'symbol')?.id;
    map.addLayer(heatLayerSpec(), firstSymbol);
  } catch {
    /* a failed glow must never take the map down with it */
  }
}
