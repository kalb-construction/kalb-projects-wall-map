# Kalb Project Atlas

An interactive wall-map experience for Kalb Construction — a full-screen, touch-first Las Vegas valley atlas that shows every active Kalb project as a tactile marker, with cinematic fly-to transitions into a project detail view. Designed for a large 16:9 touch display in the office lobby; equally usable with a mouse for desktop testing.

**This is a digital installation, not a GIS dashboard.** The basemap is a custom-drawn, brand-styled vector map (freeways, arterial grid, district labels, terrain ridges) rendered from real coordinates — no map tiles, no external services, fully offline-capable.

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Build | **Vite 5** | Instant dev server, tiny static output, `base: './'` so the bundle runs from any folder or kiosk file server |
| UI | **React 18 + TypeScript** | Modular components, typed project schema, easy handoff to any developer |
| Map | **Custom SVG engine** (in-repo) | Hand-drawn branded basemap + pan/zoom/pinch/fly-to written directly on pointer events. No tile server, no API keys, no network. Smooth on kiosk hardware because it's one SVG transform |
| Typography | **Oswald Variable** (display) + **Inter Variable** (UI), self-hosted via Fontsource | Bold condensed construction-forward headlines; no Google Fonts CDN dependency |
| Motion | CSS transitions/keyframes + a single rAF animator for camera flights | No animation library weight; `prefers-reduced-motion` respected |
| Data | `src/data/projects.json` | Clean JSON array, CMS-ready (see below) |

Deliberately **no** map SDK (MapLibre/Mapbox), no state library, no CSS framework — the experience is bespoke and the bundle stays small (~160 KB gzipped JS).

## Running it

```bash
npm install
npm run dev        # local dev at http://localhost:5173
npm run build      # static bundle in dist/
npm run preview    # serve the built bundle (kiosk mode) on :4173
```

### Kiosk deployment (Mac Mini / any box)

1. `npm run build`, serve `dist/` with any static server (or `npm run kiosk`).
2. Launch Chrome/Chromium with `--kiosk --noerrdialogs --disable-pinch-zoom http://localhost:4173` (the app handles its own pinch gestures).
3. Disable OS sleep; the built-in idle attract loop takes over after 90 s and any touch wakes the map.

## Component architecture

```
src/
├── main.tsx                 # fonts, global styles, mount
├── App.tsx                  # state owner: filters, selection, hash routing,
│                            #   idle detection, boot sequence, toast
├── types.ts                 # Project / Filters / ViewState types
├── data/
│   └── projects.json        # THE source of truth — edit projects here
├── lib/
│   ├── geo.ts               # lon/lat → world-space projection, easing
│   ├── meta.ts              # category/status/city taxonomies + tones
│   ├── filters.ts           # filter + search predicates
│   ├── rng.ts               # seeded PRNG for stable procedural art
│   └── useIdle.ts           # idle-timer + clock hooks
├── map/
│   └── Basemap.tsx          # branded vector basemap (freeways, grid, labels)
└── components/
    ├── MapView.tsx          # camera: pan / pinch / wheel / fly-to, tooltip,
    │                        #   zoom controls; owns the SVG stage
    ├── MarkerLayer.tsx      # pins, featured pulses, site clusters + radial
    │                        #   fan-out (Craig & Valley, Palm campus, …)
    ├── InsetPanels.tsx      # Northern Nevada + Arizona mini-maps
    ├── ProjectDetail.tsx    # right-side detail panel (dialog) w/ parallax hero
    ├── BuildingHero.tsx     # procedural isometric "render" per project;
    │                        #   swaps to a real image when heroImage is set
    ├── TopBar.tsx           # brand lockup, stats, search trigger, clock
    ├── Dock.tsx             # filter chip trays + featured project rail
    ├── SearchOverlay.tsx    # number/name/address search
    ├── IdleAttract.tsx      # kiosk attract loop over featured projects
    └── BootScreen.tsx       # branded loading state
```

**Data flow:** `App` owns all cross-cutting state and passes it down; `MapView` owns only camera + gesture state. Selecting a project (marker, cluster child, inset dot, featured card, or search row) funnels through one `select()` which sets the hash route (`#/project/26104`), opens the panel, and fires a camera flight that seats the marker beside the panel.

## Data schema (`src/data/projects.json`)

```jsonc
{
  "id": "26104",              // stable id, used in the #/project/<id> route
  "number": "26104",          // Kalb job number
  "name": "Dorrell Retail Building",
  "shortName": "…",           // optional, for tight map callouts
  "address": "635 E. Dorrell Ln.",
  "city": "North Las Vegas",
  "state": "NV",
  "region": "LV",             // LV = valley map · NNV / AZ = inset panels
  "lat": 36.256, "lng": -115.115,   // approximate is fine — atlas, not GIS
  "category": "Retail",       // one of the 10 types in lib/meta.ts
  "status": "Preconstruction",// Preconstruction | In Progress | Closeout | Complete
  "progress": 12,             // 0–100, drives the timeline bar
  "year": 2026,
  "featured": true,           // pulsing pin + featured rail + attract loop
  "siteId": "craig-valley",   // optional: same siteId ⇒ one cluster marker
  "siteName": "Craig & Valley",
  "description": "…",
  "heroImage": null,          // "./renders/26104.jpg" to use a real render
  "tags": ["ground-up"]       // "solar" adds PV panels to the procedural art
}
```

- **Statuses/progress are editable placeholders** — set real values as jobs move.
- **Adding a project** = adding one object. Clusters, filters, search, counts, insets all derive from the array.
- **Real renders:** drop images in `public/renders/` and set `heroImage`. Until then every project gets a stable procedural isometric building scene generated from its job number and category (Kalb palette only).

### Connecting a backend / CMS later

Everything reads from the typed `Project[]` array imported in `App.tsx`. To go live-data: replace that import with a `fetch('/api/projects')` (same shape) — or generate `projects.json` from your PM system on a schedule. The **Open Project** CTA funnels through one handler in `App.tsx` (`handleOpenProject`) — point it at a Procore/CMS URL per project when ready.

## Implementation plan (as built / next phases)

1. **Phase 1 — Atlas core (done):** branded basemap, camera engine (pan/pinch/wheel/fly-to), markers with status tones, cluster fan-out, detail panel with procedural hero, filters, search, featured rail, insets, boot + idle attract, hash deep-links.
2. **Phase 2 — Content:** replace procedural heroes with real renders/photos per project; confirm statuses/progress; tune marker coordinates on the wall unit.
3. **Phase 3 — Data feed:** nightly export from the PM system → `projects.json`; wire the CTA to per-project links.
4. **Phase 4 — Polish on hardware:** dial idle timeout, attract cadence, and touch-target sizes on the actual display; optional WebGL 3D building layer if desired.

## Design notes

- Palette is strictly brand: Kalb Red `#C10016`, Sand `#E7E3DB`, Concrete `#6A6762`, near-black ink backgrounds. Red is reserved for **live** things: active work, selection, the CTA.
- Marker language: solid red = in progress · red outline = preconstruction · concrete = delivered. Featured projects pulse.
- Touch targets ≥ 48 px, focus-visible outlines, dialog/menu roles, `prefers-reduced-motion` support.
- All chrome is glass on dark so the map stays the hero; the vignette keeps edges cinematic on a wall display.
