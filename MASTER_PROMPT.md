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
  near-black inks (`#0C0B0A` / `#141210`). No other brand colours anywhere —
  **every map pin is Kalb red.** The PM legend is a filter, not a colour key.
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
- **Never fabricate project data.** Missing values stay missing and get a
  `flags` entry; the UI shows them as "—" or an amber note.

**Performance (this is a wall display, smoothness is a feature)**
- No `backdrop-filter` anywhere. Blurring behind panels over a repainting
  WebGL map was the single biggest source of jank. Panels use opaque fills.
- No per-marker CSS `filter` (drop-shadow). Use `box-shadow`.
- While the camera moves, marker animations, transitions, and labels are
  frozen via an `.is-moving` class on the map container.
- Camera bearing lives in an external store (`src/lib/bearing.ts`), **not**
  React state — a rotating map must not re-render the component tree.
- Panels (`ProjectIndex`, `RegionNav`, `Dock`, `TopBar`) are `memo`ized.
- Renderers run with `antialias: false` and `fadeDuration: 0`, and **both**
  engines cap render resolution at 1.5× (`src/lib/dpr.ts`) so hi-DPI
  displays don't render up to 4× the pixels. MapLibre takes it as an
  option; Mapbox has none, so `window.devicePixelRatio` itself is clamped
  before the map is constructed. Regression tell-tale: wheel-zoom smearing
  into stretched-frame blur on the wall but not on a dev laptop.
- The site-cluster popup tracks its anchor with direct DOM transform
  writes, never `setState` — a popup open during camera motion must not
  re-render React per frame.
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
│  ↳ replaced by the                       │ city A–Z         │
│    DETAIL CARD when a   MAP (markers)    │  projects A–Z    │
│    project is selected                   ├──────────────────┤
│                                          │ PM legend        │
│ [compass][City][Type][Status]  [+][−][tilt][MAP][⌂]         │ bottom bar
└──────────────────────────────────────────────────────────────┘
```
- Selecting a project opens a **compact glass card on the left** (~396px,
  never full height) so the map and the index stay visible — the atlas
  always reads as one page. The Regions nav steps aside while it is open.
- Side panels collapse to a single header bar.
- The bottom bar has no background scrim — chips and buttons float.
- The card has a blueprint-grid glass backdrop, a specular top sheen, a
  parallax hero, and a scan-sweep as each project loads in. Glass is faked
  with layered gradients — **never `backdrop-filter`** (see performance).

## 5. Data model

**Source of record:** *Kalb Industries — Job List by Project Manager*,
48 active jobs, job-list report dated **07/27/2026** plus PM confirmations.
Every field below traces to that sheet. Nothing is invented; anything the
sheet left blank is recorded as a flag rather than filled with a guess.

`public/data/projects.json` — array of:

```jsonc
{
  "id": "25130",            // stable; used in the #/project/<id> route
  "number": "25130",        // Kalb job number (may be "B1329")
  "name": "Craig & Valley Retail Center",
  "address": "Craig Rd & Valley Dr",
  "city": "North Las Vegas",
  "state": "NV",
  "region": "LV",           // LV | NNV | AZ — drives the Regions quick-nav
  "lat": 36.239167,
  "lng": -115.198431,
  "category": "Retail",         // display taxonomy (src/lib/meta.ts)
  "projectType": "GU Other",    // verbatim from the PM sheet
  "team": "jj",                 // PM id — matches teams.json
  "superintendent": "SC",       // as written on the PM sheet
  "status": "In Progress",      // derived, see below
  "progress": 100,              // ONLY on finished jobs; otherwise absent
  "estCompletion": "SEP 2026",  // verbatim
  "estCompletionDate": "2026-09-30", // normalised, when parseable
  "sqFt": 239580,
  "sqFtNote": "Bidding",        // when a number wasn't available
  "flags": ["Shared pin: Craig & Valley intersection"],
  "year": 2025,
  "featured": true,
  "siteId": "craig-valley",     // same siteId ⇒ one cluster marker
  "siteName": "Craig & Valley",
  "description": "…",
  "heroImage": null,            // "./renders/25130.jpg" for a real photo
}
```

### Status is derived, never guessed

Against the report date (07/27/2026) and today:

| Sheet says | Status |
|---|---|
| "COMPLETED – FEB/2026" | **Complete** (progress 100) |
| a date already past | **Complete** (progress 100) |
| a date within 45 days | **Closeout** |
| a date further out | **In Progress** |
| "ONGOING" + sq ft "BIDDING" | **Preconstruction** |
| blank / MISSING | **In Progress** (it is on the active job list) |

`progress` is only set where it is genuinely known (finished jobs). The
detail panel shows a percentage bar only when the number exists — otherwise
it shows the estimated completion date. **Do not invent progress values.**

### Teams are the project managers

`public/data/teams.json` — `[{ "id", "name", "color" }]`, one entry per PM.
Current split: JJ 12 · RP 10 · TP 7 · MK 4 · JB 4 · RJ 4 · RC 1 ·
SB 2 (Arizona) · NG 2 · DD 1 · Dave Brown 1 = **48**.
Names are the initials from the sheet — replace them with full names as
they're confirmed. Marker colour, legend swatch, and index dot all come
from here.

Two of the sheet's own section headers are now out of date, both because of
rulings Kalb made after it was printed:
- **RJ says 3** above a block of five rows. One of those rows (26111
  Veritext) carries `RC` in its own PM cell and is filed under RC here; the
  25126 rows collapse to one. RJ is **4**.
- **TP says 8**, but 25126 moved to RJ, so TP is **7**.

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

Everything below is flagged in-app: open a project and any data-quality
note appears in an amber box in its detail panel.

1. ~~Job number 25126 used twice~~ — **resolved by Kalb:** it is one job and
   it belongs to **RJ**. The sheet's two rows — *Horizon Ridge Office Park*
   (PM TP, 2551 Bldg A) and *Rise and Ridge* (PM RJ, 2561) — are merged into
   a single record: *Rise and Ridge (Horizon Ridge Office Park)*, 17,984 sf
   across Bldg A 6,032 + Bldg B 11,952, est. 10/01/2026, super DM.

   Consequence to feed back to the sheet: **TP now shows 7 jobs, not the 8
   its section header claims**, because 25126 left that block. The record
   keeps a flag saying so.
2. **Job 26111 (Veritext)** sits inside the RJ block on the sheet but its own
   PM cell reads **RC**. Assigned to RC, which is its own legend entry.
   Suite 350 still unverified.
3. **RP's 10 Northern Nevada jobs** have no estimated completion or square
   footage on the sheet. They show as In Progress with the dates blank.
4. **TP's 8 jobs** have blank completion/sq ft cells on the sheet.
5. **Arizona (SB)** — 25900 superintendent conflict (MM vs Cliff Smith),
   26900 superintendent unverified; both missing dates and square footage.
6. **B7035 Light and Wonder** — project type, superintendent, completion and
   square footage all missing; category currently shown as Industrial.
7. **26101 Twain Luxury Vehicle Condos** — square footage still in bidding.
8. **Pin accuracy** — 8 jobs have intersection-only addresses (the six Craig
   & Valley pads, Marble Manor, Bojangles 99th & Indian School) plus Dayton
   Shell with no street number. Those pins sit on the junction; use
   `/tools/coords.html` to move them onto the actual pads.
9. **PM full names** — teams.json uses the sheet's initials.
10. **Project photos** for `heroImage`, named by job number.
11. **Superintendent name spellings.** The sheet is inconsistent; the data
    normalises and flags rather than guessing silently:
    - 25154 reads `SCOH H` → carried as **SH (Scott H.)**, matching `SH` on
      26113. Flagged; confirm the surname. Note this is *not* Scott Smith
      (`SS`), who runs 25153 and 26705 — unless Kalb says otherwise.
    - 25137 reads `MATT MERPHY`, 24106 reads `MATT MURPHY` → both carried as
      **Matt Murphy**.
