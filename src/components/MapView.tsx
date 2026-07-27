import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import type { Project, ViewState } from '../types';
import { clamp, easeInOutCubic, project, WORLD_H, WORLD_W } from '../lib/geo';
import { Basemap, BasemapLabels } from '../map/Basemap';
import { MarkerLayer } from './MarkerLayer';

interface MapViewProps {
  projects: Project[];
  visibleIds: Set<string>;
  selectedId: string | null;
  detailOpen: boolean;
  /** Bump `n` to re-trigger a fly-to for the same project id. */
  focusSignal: { id: string; n: number } | null;
  onSelect: (p: Project) => void;
  onBackgroundTap: () => void;
}

const K_MIN = 0.45;
const K_MAX = 9;

/** Screen-space insets occupied by chrome (top bar / dock / inset rail). */
const INSETS = { top: 84, right: 16, bottom: 148, left: 240 };

export function MapView({
  projects,
  visibleIds,
  selectedId,
  detailOpen,
  focusSignal,
  onSelect,
  onBackgroundTap
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 1920, h: 1080 });
  const [view, setView] = useState<ViewState>({
    cx: WORLD_W / 2,
    cy: WORLD_H / 2,
    k: 1
  });
  const [expandedSite, setExpandedSite] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);

  const viewRef = useRef(view);
  viewRef.current = view;
  const sizeRef = useRef(size);
  sizeRef.current = size;

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const dragDist = useRef(0);
  const animRef = useRef<number | null>(null);
  const interacted = useRef(false);

  /** Cover-fit base scale — k is a multiplier on top of this. */
  const s0 = useMemo(
    () => Math.max(size.w / WORLD_W, size.h / WORLD_H),
    [size]
  );
  const s = s0 * view.k;

  const markerBounds = useMemo(() => {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const pr of projects) {
      const pt = project(pr.lng, pr.lat);
      minX = Math.min(minX, pt.x);
      minY = Math.min(minY, pt.y);
      maxX = Math.max(maxX, pt.x);
      maxY = Math.max(maxY, pt.y);
    }
    return { minX, minY, maxX, maxY };
  }, [projects]);

  const stopAnim = useCallback(() => {
    if (animRef.current !== null) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }
  }, []);

  const flyTo = useCallback(
    (target: ViewState, ms = 950) => {
      stopAnim();
      const from = { ...viewRef.current };
      const start = performance.now();
      const step = (now: number) => {
        const t = clamp((now - start) / ms, 0, 1);
        const e = easeInOutCubic(t);
        setView({
          cx: from.cx + (target.cx - from.cx) * e,
          cy: from.cy + (target.cy - from.cy) * e,
          k: from.k + (target.k - from.k) * e
        });
        if (t < 1) {
          animRef.current = requestAnimationFrame(step);
        } else {
          animRef.current = null;
        }
      };
      animRef.current = requestAnimationFrame(step);
    },
    [stopAnim]
  );

  /** Compute the home view: all valley markers framed inside the chrome. */
  const homeView = useCallback((): ViewState => {
    const { w, h } = sizeRef.current;
    const base = Math.max(w / WORLD_W, h / WORLD_H);
    const bw = markerBounds.maxX - markerBounds.minX + 140;
    const bh = markerBounds.maxY - markerBounds.minY + 140;
    const availW = w - INSETS.left - INSETS.right;
    const availH = h - INSETS.top - INSETS.bottom;
    const fit = Math.min(availW / bw, availH / bh);
    const k = clamp(fit / base, K_MIN, K_MAX);
    const sFit = base * k;
    const wcx = (markerBounds.minX + markerBounds.maxX) / 2;
    const wcy = (markerBounds.minY + markerBounds.maxY) / 2;
    // Anchor the marker centroid at the center of the un-chromed area.
    const icx = INSETS.left + availW / 2;
    const icy = INSETS.top + availH / 2;
    return {
      cx: wcx + (w / 2 - icx) / sFit,
      cy: wcy + (h / 2 - icy) / sFit,
      k
    };
  }, [markerBounds]);

  // Measure container.
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Go home on first measure (and on resize until the user interacts).
  useEffect(() => {
    if (!interacted.current) setView(homeView());
  }, [size, homeView]);

  // Fly to a project when the app requests focus.
  useEffect(() => {
    if (!focusSignal) return;
    const target = projects.find((p) => p.id === focusSignal.id);
    if (!target) return;
    const { w, h } = sizeRef.current;
    const pt = project(target.lng, target.lat);
    const k = clamp(Math.max(viewRef.current.k, 1.9), K_MIN, K_MAX);
    const sT = (Math.max(w / WORLD_W, h / WORLD_H)) * k;
    // With the detail panel open, seat the marker ~30% from the left edge.
    const ax = detailOpen ? w * 0.3 : w * 0.5;
    const ay = h * 0.47;
    setExpandedSite(target.siteId ?? null);
    flyTo({ cx: pt.x + (w / 2 - ax) / sT, cy: pt.y + (h / 2 - ay) / sT, k });
  }, [focusSignal, detailOpen, projects, flyTo]);

  const zoomAbout = useCallback((px: number, py: number, factor: number) => {
    const { w, h } = sizeRef.current;
    const v = viewRef.current;
    const base = Math.max(w / WORLD_W, h / WORLD_H);
    const k2 = clamp(v.k * factor, K_MIN, K_MAX);
    const s1 = base * v.k;
    const s2 = base * k2;
    const wx = v.cx + (px - w / 2) / s1;
    const wy = v.cy + (py - h / 2) / s1;
    setView({
      cx: clamp(wx - (px - w / 2) / s2, -200, WORLD_W + 200),
      cy: clamp(wy - (py - h / 2) / s2, -200, WORLD_H + 200),
      k: k2
    });
  }, []);

  // --- pointer interaction -------------------------------------------------

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) dragDist.current = 0;
    stopAnim();
    interacted.current = true;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const pts = pointers.current;
    const v = viewRef.current;

    if (pts.size === 1) {
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      dragDist.current += Math.abs(dx) + Math.abs(dy);
      if (dragDist.current > 2) {
        setView({
          cx: clamp(v.cx - dx / s, -200, WORLD_W + 200),
          cy: clamp(v.cy - dy / s, -200, WORLD_H + 200),
          k: v.k
        });
      }
    } else if (pts.size === 2) {
      const ids = [...pts.keys()];
      const other = pts.get(ids[0] === e.pointerId ? ids[1] : ids[0])!;
      const dPrev = Math.hypot(prev.x - other.x, prev.y - other.y);
      const dNew = Math.hypot(e.clientX - other.x, e.clientY - other.y);
      dragDist.current += 10;
      if (dPrev > 0) {
        const rect = containerRef.current!.getBoundingClientRect();
        const mx = (e.clientX + other.x) / 2 - rect.left;
        const my = (e.clientY + other.y) / 2 - rect.top;
        zoomAbout(mx, my, dNew / dPrev);
      }
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
  };

  const onWheel = (e: React.WheelEvent) => {
    const rect = containerRef.current!.getBoundingClientRect();
    interacted.current = true;
    zoomAbout(
      e.clientX - rect.left,
      e.clientY - rect.top,
      Math.pow(1.0016, -e.deltaY)
    );
  };

  const wasDrag = useCallback(() => dragDist.current > 8, []);

  const handleBackgroundClick = () => {
    if (wasDrag()) return;
    setExpandedSite(null);
    setHoverId(null);
    onBackgroundTap();
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    const rect = containerRef.current!.getBoundingClientRect();
    zoomAbout(e.clientX - rect.left, e.clientY - rect.top, 1.7);
  };

  // --- hover tooltip -------------------------------------------------------

  const hoverProject = hoverId
    ? projects.find((p) => p.id === hoverId) ?? null
    : null;
  let tooltipPos: { x: number; y: number } | null = null;
  if (hoverProject) {
    const pt = project(hoverProject.lng, hoverProject.lat);
    tooltipPos = {
      x: size.w / 2 + (pt.x - view.cx) * s,
      y: size.h / 2 + (pt.y - view.cy) * s
    };
  }

  const tx = size.w / 2 - view.cx * s;
  const ty = size.h / 2 - view.cy * s;

  return (
    <div
      ref={containerRef}
      className="map-stage"
      onWheel={onWheel}
      onDoubleClick={handleDoubleClick}
    >
      <svg
        className="map-svg"
        width={size.w}
        height={size.h}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={handleBackgroundClick}
      >
        <defs>
          <radialGradient id="valleyFloor" cx="46%" cy="42%" r="75%">
            <stop offset="0%" stopColor="#1b1815" stopOpacity="0.95" />
            <stop offset="60%" stopColor="#151310" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#0c0b0a" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="markerGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#c10016" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#c10016" stopOpacity="0" />
          </radialGradient>
        </defs>
        <g transform={`translate(${tx},${ty}) scale(${s})`}>
          <Basemap />
          <BasemapLabels scale={s} />
          <MarkerLayer
            projects={projects}
            scale={s}
            visibleIds={visibleIds}
            selectedId={selectedId}
            expandedSite={expandedSite}
            onExpandSite={(id) => {
              if (!wasDrag()) setExpandedSite(id);
            }}
            onSelect={(p) => {
              if (!wasDrag()) onSelect(p);
            }}
            onHover={setHoverId}
          />
        </g>
      </svg>

      {hoverProject && tooltipPos && !detailOpen && (
        <div
          className="map-tooltip"
          style={{ left: tooltipPos.x, top: tooltipPos.y - 34 }}
        >
          <span className="tt-number">{hoverProject.number}</span>
          <span className="tt-name">{hoverProject.name}</span>
          <span className="tt-meta">
            {hoverProject.city} · {hoverProject.status}
          </span>
        </div>
      )}

      <div className="map-controls" role="group" aria-label="Map controls">
        <button
          className="ctl-btn"
          aria-label="Zoom in"
          onClick={() => zoomAbout(size.w / 2, size.h / 2, 1.45)}
        >
          +
        </button>
        <button
          className="ctl-btn"
          aria-label="Zoom out"
          onClick={() => zoomAbout(size.w / 2, size.h / 2, 1 / 1.45)}
        >
          −
        </button>
        <button
          className="ctl-btn ctl-home"
          aria-label="Reset view"
          onClick={() => {
            interacted.current = true;
            flyTo(homeView());
          }}
        >
          ⌂
        </button>
      </div>
    </div>
  );
}
