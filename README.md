# Kalb Project Atlas

> **Read [`MASTER_PROMPT.md`](MASTER_PROMPT.md) first** — it is the binding
> spec: brand rules, performance rules, data model, and what is still open.
> To put it online, see [`DEPLOY.md`](DEPLOY.md) (Vercel).


An interactive wall-map experience for Kalb Construction — a full-screen, touch-first Las Vegas valley atlas that shows every active Kalb project as a tactile marker, with cinematic fly-to transitions into a project detail view. Designed for a large 16:9 touch display in the office lobby; equally usable with a mouse for desktop testing.

**Zillow-real map, Kalb-branded chrome.** The basemap is a natural, realistic street map (MapLibre GL + OpenFreeMap vector tiles — no API key) with real 3D building extrusions and a tilted cinematic camera. Every project sits at its real-world coordinates; selecting one flies the camera in with an Oryzo-style swoop. Internet access is required for map tiles; all UI, markers, and data work regardless.

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Build | **Vite 5** | Instant dev server, tiny static output, `base: './'` so the bundle runs from any folder or kiosk file server |
| UI | **React 18 + TypeScript** | Modular components, typed project schema, easy handoff to any developer |
| Map | **MapLibre GL JS + OpenFreeMap tiles** | Real, natural-color street basemap (Zillow-like), no API key or account. 3D building extrusions (`fill-extrusion`), pitch/bearing camera, buttery `flyTo` cinematics, pinch/rotate touch gestures |
| Typography | **Oswald Variable** (display) + **Inter Variable** (UI), self-hosted via Fontsource | Bold condensed construction-forward headlines; no Google Fonts CDN dependency |
| Motion | CSS transitions/keyframes + a single rAF animator for camera flights | No animation library weight; `prefers-reduced-motion` respected |
| Data | `src/data/projects.json` | Clean JSON array, CMS-ready (see below) |

No state library, no CSS framework — the chrome is bespoke. Map tiles are fetched from tiles.openfreemap.org at runtime (free, keyless); everything else is self-hosted.

## Running it

```bash
npm install
npm run dev        # local dev at http://localhost:5173
npm run build      # static bundle in dist/
npm run preview    # serve the built bundle (kiosk mode) on :4173
```

### Google Photorealistic 3D Tiles (the "3D" button)

The most cinematic mode — Google's photoreal 3D city mesh (like Google Earth
flyovers) rendered inside the atlas via deck.gl. It needs a Google Maps
Platform API key with billing enabled:

1. [console.cloud.google.com](https://console.cloud.google.com) → create/select a project (billing must be enabled).
2. **APIs & Services → Library** → enable **Map Tiles API**.
3. **APIs & Services → Credentials → Create credentials → API key.**
4. Restrict the key (recommended): API restrictions → *Map Tiles API* only;
   Website restrictions → your dev/kiosk origins (e.g. `http://localhost:5173`).
5. `copy .env.example .env` and paste the key into `VITE_GOOGLE_MAPS_API_KEY`, then restart `npm run dev`.
   (Quick test without a .env: open `http://localhost:5173/?gkey=YOUR_KEY`.)

A **3D** button appears in the map controls once a key is present. Turning it
on streams Google's photorealistic mesh over the satellite base; the drone
orbit around a selected project uses it to full effect. Usage is billed by
Google per tile request — a single lobby kiosk is typically modest, but check
current Map Tiles API pricing and set a budget alert on the project. The
"Map data © Google" attribution shown on screen is required by Google's terms.

### Kiosk deployment (Mac Mini / any box)

1. `npm run build`, serve `dist/` with any static server (or `npm run kiosk`).
2. Launch Chrome/Chromium with `--kiosk --noerrdialogs --disable-pinch-zoom http://localhost:4173` (the app handles its own pinch gestures).
3. Disable OS sleep; the built-in idle attract loop takes over after 90 s and any touch wakes the map.

## Updating the dashboard yourself (no developer needed)

This is Kalb's own dashboard — all content lives in two plain places:

- **`data/projects.json`** — every project's name, address, coordinates,
  status, description, photo. Edit it with any text editor.
  - During development: `public/data/projects.json` (refresh the browser).
  - On the kiosk (built app): `dist/data/projects.json` — edit and refresh,
    **no rebuild required**.
- **`renders/`** — your own photos of finished projects, named by job number
  (`26104.jpg`). Point a project's `"heroImage"` at `"./renders/26104.jpg"`
  and its detail panel shows the real building. Your own photography will
  always be fresher than any satellite provider's imagery.

- **`data/teams.json`** — the color-coded team legend. Each entry is
  `{ "id", "name", "color" }`. Rename the placeholder teams to your real
  ones, pick any colors, then assign a project to a team by adding
  `"team": "team-2"` to it in `projects.json`. Markers, the legend, and the
  index dots all take their color from here; anything without a `team`
  falls under **Unassigned** (Kalb red).

The right-hand **Project Index** lists every project grouped by city (A→Z,
and A→Z within each city). Tapping a row flies the map to it; tapping a
team in the legend highlights just that team's projects.

### Checking / fixing pin locations

Open **`/tools/coords.html`** while the app is running (e.g.
`http://localhost:5173/tools/coords.html`). It lists all projects with two
Google Maps links each — one for the written address, one for the pin the
atlas currently uses — so you can eyeball them side by side. Paste a
corrected `lat, lng` (right-click in Google Maps → click the coordinates to
copy) into any row, then **Download corrected projects.json** and drop it
into `public/data/` (and `dist/data/` on the kiosk).

Rows whose address is a road intersection rather than a street number are
flagged **INTERSECTION** — those pins sit at the junction by definition and
are the ones worth relocating onto the actual building pad.

Adding a project = adding one JSON object. Removing, re-pinning (lat/lng),
renaming, featuring — all one-line edits to the same file.

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
│   ├── meta.ts              # category/status/city taxonomies + tones
│   ├── filters.ts           # filter + search predicates
│   ├── regions.ts           # region quick-nav definitions + bounds math
│   ├── rng.ts               # seeded PRNG for stable procedural art
│   └── useIdle.ts           # idle-timer + clock hooks
└── components/
    ├── MapLibreView.tsx     # MapLibre map: real tiles, 3D buildings,
    │                        #   Kalb DOM markers, cluster popups, fly-tos
    ├── RegionNav.tsx        # collapsible one-tap flights: LV / NNV / AZ
    ├── ProjectDetail.tsx    # right-side detail panel (dialog) w/ parallax hero
    ├── BuildingHero.tsx     # procedural isometric "render" per project;
    │                        #   swaps to a real image when heroImage is set
    ├── TopBar.tsx           # brand lockup, stats, search trigger, clock
    ├── Dock.tsx             # city / project-type filter chip trays
    ├── ProjectIndex.tsx     # collapsible right rail: A-Z index by city
    │                        #   + color-coded team legend
    ├── SearchOverlay.tsx    # number/name/address search
    ├── IdleAttract.tsx      # kiosk attract loop over featured projects
    └── BootScreen.tsx       # branded loading state
```

**Data flow:** `App` owns all cross-cutting state; `MapLibreView` owns only the camera. Selecting a project (marker, cluster popup row, featured card, or search row) funnels through one `select()` which sets the hash route (`#/project/26104`), opens the panel, and flies the camera (zoom + tilt + bearing swing) to seat the marker beside the panel. Picking a **City** filter or a **Region** row flies the camera to that area — Henderson, Northern Nevada, and Arizona are one tap away.

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
  "lat": 36.2612, "lng": -115.124,  // real-world coords — nudge here if a pin is off
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

- **All projects are currently marked `Complete`** per the portfolio. Statuses/progress are editable if live jobs are added later.
- **Coordinates were placed from the street addresses** — if any pin sits a block off, fix its `lat`/`lng` here (Google Maps right-click → copy coordinates) and the app hot-reloads.
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
