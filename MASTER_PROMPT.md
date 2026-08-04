# Kalb Project Atlas — Master Prompt & Specification

This is the single source of truth for the project: what it is, how it must
look and behave, how the code is organized, and the rules any future
change (by a person or an AI assistant) has to respect.

Treat everything under **Non-negotiables** as binding. Everything under
**Open items** is still Kalb's to decide.

---

## 1. The one-paragraph brief

Build a full-screen, touch-first **interactive wall map** for Kalb
Construction, running on a large 16:9 display in the office lobby. It shows
every Kalb project on a real, modern map at its true coordinates. Touching a
project flies the camera to it and opens a detail panel. A right-hand index
lists every project by city, colour-coded by the team that runs it. The feel
is a **cinematic architecture atlas** — dark Kalb-branded chrome floating
over a clean, real map — not a GIS dashboard and not a generic corporate
site. It must run all day unattended, stay smooth under a finger, and be
updatable by Kalb staff without a developer.

## 2. Non-negotiables

**Brand**
- Palette is exactly: Kalb Red `#C10016`, Sand `#E7E3DB`, Concrete `#6A6762`,
  near-black inks (`#0C0B0A` / `#141210`). No other brand colours.
  Team colours (see §5) are the one deliberate exception, and they only
  appear on markers, legend swatches, and index dots.
- Type: **Oswald** for display/headings (condensed, construction-forward),
  **Inter** for UI text. Both self-hosted — never a font CDN.
- The Kalb logo assets in `public/brand/` are the only marks used.
- Red is reserved for live/important things: selection, counts, the primary
  CTA, the compass needle. Never decorative red.

**Behaviour**
- Everything is reachable by touch with ≥44px targets. No hover-only actions.
- Nothing may block the map: chrome is compact, collapsible, and translucent
  only where it doesn't hurt legibility.
- The app must never show a blank screen. Every external dependency (map
  tiles, terrain, 3D tiles, data files) has a fallback path, and failures
  surface a readable message instead of an empty canvas.
- Text must wrap, never be clipped mid-word. Panels scroll internally.
- The kiosk idles into an attract loop after 90s and wakes on any touch.

**Performance (this is a wall display, smoothness is a feature)**
- No `backdrop-filter` anywhere. Blurring behind panels over a repainting
  WebGL map was the single biggest source of jank. Panels use opaque fills.
- No per-marker CSS `filter` (drop-shadow). Use `box-shadow`.
- While the camera moves, marker animations, transitions, and labels are
  frozen via an `.is-moving` class on the map container.
- Camera bearing lives in an external store (`src/lib/bearing.ts`), **not**
  React state — a rotating map must not re-render the component tree.
- Panels (`ProjectIndex`, `RegionNav`, `Dock`, `TopBar`) are `memo`ized.
- Renderers run with `antialias: false` and `fadeDuration: 0`; MapLibre caps
  `pixelRatio` at 1.5 so 4K displays don't render 4× the pixels.
- 3D terrain only switches on above zoom 9.5 (below that the DEM mesh tears
  the basemap into shards).
- Before claiming a perf fix: measure or reason about what work happens
  *per frame*, don't just tweak settings.

**Data & governance**
- All content lives in plain JSON that non-developers can edit
  (`public/data/projects.json`, `public/data/teams.json`). On the kiosk the
  same files sit in `dist/data/` and take effect on refresh — **no rebuild**.
- Never invent project data. Coordinates, addresses, job numbers, teams, and
  statuses come from Kalb. If something is unknown, leave it out and say so
  rather than guessing.
- Secrets (`.env`) never get committed.

## 3. Tech stack

| Layer | Choice |
|---|---|
| Build | Vite 5, `base: './'` so the bundle runs from any path |
| UI | React 18 + TypeScript, no state library, no CSS framework |
| Map (premium) | **Mapbox GL JS v3** — used when `VITE_MAPBOX_TOKEN` is set. Vector rendering, real 3D buildings, dawn/day/dusk/night lighting presets |
| Map (fallback) | **MapLibre GL** over OpenStreetMap / CARTO / Esri raster tiles + free AWS terrain — keyless, always available |
| Optional | Google Photorealistic 3D Tiles via deck.gl, behind `VITE_GOOGLE_MAPS_API_KEY` |
| Fonts | Oswald + Inter, self-hosted via Fontsource |

Engine selection is automatic: Mapbox if a token is present and it renders;
otherwise MapLibre. A Mapbox failure (bad token, blocked host) falls back
within 9 seconds and explains itself in a toast.

## 4. Screen layout

```
┌──────────────────────────────────────────────────────────────┐
│ [Kalb logo | PROJECT ATLAS]        [count · Search · clock]  │ top bar
│                                                              │
│ [REGIONS ▾]                              [PROJECT INDEX ▾]   │
│                                          │ city A–Z         │
│                MAP (markers)             │  projects A–Z    │
│                                          │  ...             │
│                                          ├──────────────────┤
│                                          │ TEAMS legend     │
│ [compass][City ▾][Type ▾] 48 shown   [+][−][tilt][MAP][⌂]  │ bottom bar
└──────────────────────────────────────────────────────────────┘
```
- Selecting a project slides a **detail panel** over the right side.
- Both side panels collapse to a single header bar.
- The bottom bar has no background scrim — chips and buttons float.

## 5. Data model

`public/data/projects.json` — array of:

```jsonc
{
  "id": "26104",            // stable; used in the #/project/<id> route
  "number": "26104",        // Kalb job number (may be "B1329")
  "name": "Dorrell Retail Building",
  "shortName": "…",         // optional, for map callouts and the index
  "address": "635 E. Dorrell Ln.",
  "city": "North Las Vegas",
  "state": "NV",
  "region": "LV",           // LV | NNV | AZ — drives the Regions quick-nav
  "lat": 36.285249,
  "lng": -115.133593,
  "category": "Retail",     // one of the types in src/lib/meta.ts
  "team": "team-2",         // optional; matches an id in teams.json
  "status": "Complete",     // Preconstruction | In Progress | Closeout | Complete
  "progress": 100,          // 0–100
  "year": 2026,             // optional (B-numbered jobs have none)
  "featured": true,         // pulses on the map, appears in the attract loop
  "siteId": "craig-valley", // optional: same siteId ⇒ one cluster marker
  "siteName": "Craig & Valley",
  "description": "…",
  "heroImage": null,        // "./renders/26104.jpg" for a real photo
  "tags": ["ground-up"]
}
```

`public/data/teams.json` — `[{ "id", "name", "color" }]`. A project with no
`team` falls under **Unassigned** (Kalb red).

## 6. Feature list (what "done" means)

- Real map, real coordinates, three view modes (light streets / 3D city with
  lighting / satellite) and a north-up compass.
- Markers: Kalb pin, team-coloured, pulse when selected, label at zoom.
- Multi-project sites collapse to one counted marker that opens a list popup.
- Cinematic fly-to on selection, then a slow drone orbit until touched.
- Detail panel: number, name, address, category, status + progress bar,
  description, hero image slot, prev/next, CTA.
- Right index rail: cities A→Z, projects A→Z within each, team dots, counts.
- Team legend: tap a team to highlight only its projects; "Show all" clears.
- Filters: City and Type; picking a city also flies the camera there.
- Search by job number, name, or address.
- Regions quick-nav: Las Vegas Valley / Northern Nevada / Arizona.
- Branded boot screen; 90s idle attract loop over featured projects.
- `/tools/coords.html` — audit every pin against Google Maps and export a
  corrected `projects.json`.

## 7. Working agreement for future changes

1. **Verify, don't assert.** Build, run, and check the actual screen before
   saying something works. If you can't verify (e.g. no network for
   geocoding), say so plainly instead of implying you did.
2. **Fix causes, not symptoms.** Especially for "it feels slow" — find the
   per-frame work.
3. **Keep the data editable by non-developers.** Any new field must be
   plain JSON with a sensible default, and documented in the README.
4. **Don't add dependencies casually.** Every one must earn its place; heavy
   ones (deck.gl, mapbox-gl) are dynamically imported.
5. **Respect the fallbacks.** Never make a network service mandatory.
6. **Stay on the working branch** (`claude/kalb-construction-wall-map-4ifnh8`)
   and never touch other Kalb repositories.

## 8. Open items (Kalb to confirm)

- **Team roster** — real team names and which job numbers belong to each.
  Until then every project shows as Unassigned.
- **Pin accuracy** — 9 jobs have intersection-only addresses (the six Craig &
  Valley pads, Marble Manor, Bojangles 99th & Indian School, Dayton Shell)
  and sit on the junction. They need per-building coordinates.
- **Categories** for the newest jobs were inferred from their names.
- **Statuses** — everything currently reads Complete.
- **Project photos** for `heroImage`, named by job number.
- **"Open Project" CTA** — where it should link (Procore, SharePoint, …).
