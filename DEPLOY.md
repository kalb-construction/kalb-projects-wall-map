# Deploying the Kalb Project Atlas to Vercel

The app is a static site (HTML/JS/CSS — no server), so Vercel hosts it for
free and redeploys automatically whenever the repo changes.

---

## Deploy readiness — verified

Checked against a clean clone, running exactly what Vercel runs
(`npm ci` → `npm run build`) on Node 22:

| Check | Result |
|---|---|
| `npm ci` from `package-lock.json` | 424 packages, no errors |
| `npm run build` (`tsc -b && vite build`) | passes, ~20 s |
| Build output | `dist/` — includes `data/`, `brand/`, `renders/`, `tools/` |
| `dist/data/projects.json` | present, served statically |
| Node version | pinned via `engines.node` `22.x` in package.json |
| Config | `vercel.json` present — framework, build command, output dir, cache headers |
| Secrets | `.env` is git-ignored; no token is committed |
| Hardcoded hosts | none — no `localhost` anywhere in `src/` or `public/` |
| Routing | hash-based (`#/project/…`), so no rewrite rules are needed |

### Build warnings you can ignore

Three show up in Vercel's build log and none of them need action:

- **"chunks larger than 500 kB"** — that's the Mapbox library. Expected, and
  harmless on a wall display over office wifi.
- **`npm warn deprecated esri-loader@3.7.0`** and **`jpeg-exif@1.1.4`** —
  neither is ours. Both arrive transitively through `deck.gl` →
  `@deck.gl/arcgis` / `@arcgis/core`, which comes along with deck.gl even
  though we only use its 3D-tiles layer. Removing them means dropping
  deck.gl, i.e. dropping the optional Google Photorealistic 3D Tiles view.
  Not worth it. Check `npm ls esri-loader jpeg-exif` to confirm.
- **`Export "WebGLDevice" … was reexported through module`** — a luma.gl
  packaging notice from the same dependency. Cosmetic.

### Project Settings vs vercel.json

Vercel may show *"Configuration Settings in the current Production deployment
differ from your current Project Settings"* on the Settings → Build page.
That's because `vercel.json` in this repo already declares the framework,
build command, and output directory, and the dashboard has an override
switched on for Output Directory as well.

`vercel.json` wins, so the banner is cosmetic — but keep the config in the
repo, not the dashboard: **Settings → Build and Deployment → turn the
Output Directory *Override* toggle off** and leave every other override off
too. Then there is exactly one place that defines how this site builds.

---

## One-time setup

### 1. Create the Vercel account
Go to [vercel.com/signup](https://vercel.com/signup) and sign up **with
GitHub** using the Kalb account that can see `kalb-ai/kalb-projects-wall-map`.
Choose the **Hobby (free)** plan — a static site like this stays free.

### 2. Import the repository
1. Vercel dashboard → **Add New… → Project**.
2. Find **kalb-projects-wall-map** → **Import**. (If it isn't listed, click
   *Adjust GitHub App Permissions* and grant access to the repo.)
3. Vercel reads `vercel.json` and fills in the settings itself:
   - Framework: **Vite**
   - Build command: `npm run build`
   - Output directory: `dist`

### 3. Add the environment variable
Still on the import screen (or later under **Settings → Environment
Variables**), add:

| Name | Value | Environments |
|---|---|---|
| `VITE_MAPBOX_TOKEN` | `pk.…` (from account.mapbox.com) | Production, Preview, Development |

Without the Mapbox token the site still works — it falls back to the free map
engine — but with it you get the smooth vector map, 3D city view, and
lighting presets.

#### Restricting the Mapbox token
The token is compiled into the public JavaScript bundle. That is normal and
unavoidable for a browser map: `pk.` tokens are designed to be public, and no
amount of hiding changes that. What stops someone else spending your quota is
a **URL restriction**, which ties the token to your domain.

The **Default public token cannot be restricted** — that is why the option
looks missing. Create a new one instead:

1. Mapbox → **Access tokens** → **Create a token**
2. Name it `kalb-wall-map`, leave the default public scopes
3. Under **URL restrictions**, add:
   - `https://kalb-projects-wall-map.vercel.app`
   - `http://localhost:5173` (only if you build locally)
4. Create it, put the new value in `VITE_MAPBOX_TOKEN`, redeploy
5. Back in Mapbox, **delete the old token** — rotation is not finished until
   the old one stops working

### Access — public by decision

The site is deliberately **public**: anyone with the URL sees the map and the
project data. An access gate (secret link + cookie) was built and abandoned —
three routing-layer attempts failed to hold on Vercel's edge network, and the
gate also broke the one thing the wall needs most: the display and the
installed app loading unattended. The decision (Aug 2026) was that a lobby
display already shows this data to every visitor, so the URL staying quiet is
enough.

What still stands from that work:

- **Search engines are blocked three ways** — `robots.txt`, a `noindex` meta
  tag, and an `X-Robots-Tag` header — so the site never turns up in Google.
  Only someone given the URL finds it.
- **The Mapbox token is URL-restricted** (see above), so the only real secret
  in the bundle is useless off this domain.

`SITE_KEY` in Vercel is no longer read by anything; it can be deleted.

If real access control is ever wanted, the honest options are Vercel's paid
Password Protection, or hosting inside the office network instead
(`npm run build` + `npm run kiosk` on the Mac Mini).

### 4. Deploy
Click **Deploy**. First build takes ~1–2 minutes and you get a URL like
`kalb-projects-wall-map.vercel.app`.

### 5. Branch — nothing to do
Vercel builds the repository's **default branch**, and this repo's default
branch is already `claude/kalb-construction-wall-map-4ifnh8` (it is the only
branch). So the import picks up the right code with no settings change.

If the repo ever gains a `main` branch and that becomes the default, set
**Settings → Git → Production Branch** back to whichever branch holds the
live map.

---

## Decide who can see it

A plain Vercel deployment is **public** — anyone with the URL sees every
Kalb job number, address, and team. If that's not acceptable, pick one:

- **Vercel Password Protection** (Settings → Deployment Protection) — one
  shared password for the whole site. Requires a paid plan.
- **Keep it internal** — don't deploy publicly; run the kiosk from the
  office machine (`npm run build` + `npm run kiosk`) as before.
- **Accept it** — the data is project names and street addresses, i.e.
  things already visible on the buildings themselves.

Confirm this with Kalb before sharing the link widely.

---

## How updates reach every screen

Nobody has to restart anything.

**A window that is already open** — the lobby display, or an installed
desktop app left running — polls `version.json` every 15 minutes. That file
carries the build's content hash, so it changes when the code changes and
*doesn't* when a redeploy produces identical output. When it changes, the
page reloads **the next time the screen is idle**, so a reload can never
interrupt somebody mid-look. A machine waking from sleep checks immediately
rather than waiting out the interval.

**A fresh launch** is handled by cache headers in `vercel.json`:
`index.html`, `manifest.webmanifest` and `version.json` are `no-cache`
(revalidated every time), while the hashed files under `/assets` are
`immutable` — they can be cached forever because a new build gives them new
filenames.

**Project data** (`data/projects.json`, `data/teams.json`) is `no-store` and
read at load, so a data edit shows up on the next refresh — no rebuild, and
the same idle-reload picks it up on the wall within 15 minutes.

The installed desktop app is just Chrome pointed at the same URL, so all of
the above applies to it identically. There is no separate copy to update.

---

## Updating content after launch

Because the app reads `data/projects.json` and `data/teams.json` at runtime,
updating the wall map is a text edit — but on Vercel it goes through GitHub
rather than the kiosk's hard drive:

1. GitHub → `kalb-projects-wall-map` → `public/data/projects.json` → pencil icon.
2. Edit (add a project, fix a pin, assign a team) → **Commit changes**.
3. Vercel rebuilds in about a minute; refresh the wall display.

The `/tools/coords.html` page works on the deployed site too — open
`https://<your-vercel-url>/tools/coords.html`, correct pins, download the
patched `projects.json`, and upload it to GitHub the same way.

---

## Pointing the lobby display at it

**Use the launcher, not a plain Chrome shortcut:** `kiosk/kalb-atlas-kiosk.bat`.

Copy that file onto the kiosk PC, edit `ATLAS_URL` at the top if you need
`?overscan=3`, then put a shortcut to it in `shell:startup` (press
Win+R, type `shell:startup`, drop the shortcut in that folder).

It does four things a shortcut cannot:

- **relaunches Chrome if it closes or crashes**, forever, so a GPU crash or
  an accidental close does not leave a black wall until Monday
- **runs its own Chrome profile**, so the display can never inherit tabs,
  bookmarks or a signed-in account from someone's normal browsing
- **suppresses the "Restore pages?" bar**, which after a power cut otherwise
  sits across the top of the wall until someone dismisses it
- **turns off sleep, screen blanking and disk spindown** — a TV that goes
  black at 3pm because Windows decided to sleep is the most common way a
  lobby display "breaks"

If you must launch by hand, the flags that matter are:

```
chrome.exe --kiosk --noerrdialogs --disable-session-crashed-bubble
           --disable-infobars --no-first-run --disable-pinch
           --user-data-dir="%LOCALAPPDATA%\KalbAtlasKiosk"
           https://<your-vercel-url>
```

(macOS: `open -a "Google Chrome" --args --kiosk …`)

> Earlier revisions of this document suggested `--disable-pinch-zoom`. That
> is not a Chromium switch and did nothing; the real one is `--disable-pinch`.

There is also a **full-screen button** in the bottom-right control cluster,
so a display with no keyboard can go edge-to-edge with one tap.

### What the display does on its own

Worth knowing before you walk away from it:

| After | It does this |
|---|---|
| 90 seconds idle | Clears the last visitor's project, filters and search, returns the camera home, hides the mouse cursor, and starts the photo screensaver |
| Any touch | Screensaver ends, back to the live map |
| A network blip | Keeps retrying on its own and says so on screen; recovers with no help |
| A new deploy | Reloads itself, but only while idle and only if the network answers |
| A render error | Shows the error, then reloads itself — up to three times, then stops so the message can be read |
| A GPU/driver reset | Detects the lost graphics context and reloads |
| Hours passing | Re-checks project statuses hourly, so a job that passes its completion date turns grey without a reload |

### Making it fit a TV exactly

Work through these in order; the first two matter most and are settings on
the TV and the PC, not in the app.

**1. Turn off the TV's overscan.** Most TVs zoom the picture ~3 % and crop
the edges — that is the usual reason a page "doesn't quite fit". In the TV's
picture menu find the aspect/size setting and choose the 1:1 option:

| Brand | Setting |
|---|---|
| Samsung | Picture Size → **Screen Fit** |
| LG | Aspect Ratio → **Just Scan** |
| Sony | Screen → Display Area → **Full Pixel** |
| Vizio / TCL / Hisense | Aspect / Picture Size → **Native** or **Dot by Dot** |

Also set the TV's picture mode to **Game** or **PC** — it disables motion
smoothing, which otherwise adds visible lag when the map pans.

**2. Match the PC's output to the panel.** In Windows, Settings → System →
Display: set **Resolution** to the TV's native resolution (3840×2160 for a
4K panel) and **Scale** to 100 %. Any other resolution makes the TV rescale
the image, which is what looks soft.

**3. Only if the TV still crops** — some sets can't disable overscan. Add
`?overscan=3` to the kiosk URL. It insets all the chrome (top bar, index
rail, buttons) by 3 % of the screen so nothing is cut off, while the map
still bleeds edge to edge. Use any value 0–12; 3 suits most TVs.

**4. Sharpness vs smoothness.** The app renders at up to 1.5× the CSS
resolution — tuned so a hi-DPI screen stays fluid. On a 4K TV at 100 %
scaling this already means full native pixels, so there is nothing to
change. If you run Windows scaling above 150 % and want maximum sharpness
over frame rate, add `?dpr=2`; on a weak PC, `?dpr=1` is the cheapest.

Parameters combine: `…vercel.app/?overscan=3&dpr=2`.

### Reading the diagnostics

Tap the **Kalb logo three times** to show a large readout across the bottom
of the screen — no address bar and no keyboard needed, which is the point on
a TV. Three more taps hide it. `?diag=1` does the same from the URL, and
`?diag=0` explicitly turns it off.

```
Mapbox  ·  dpr 1  ·  render 1.00×  ·  58 fps  ·  1920×1080
```

| Field | Means |
|---|---|
| engine | `Mapbox` = premium vector map; `MapLibre` = the token isn't reaching the page |
| `dpr` | the display's device pixel ratio |
| `render` | how many pixels per CSS pixel the map actually draws. Below `dpr` means it is upscaling — raise it with `?dpr=` if the picture looks soft |
| `fps` | frame rate. Watch it **while panning**, not at rest |
| last | the CSS viewport, useful for confirming the browser really is full-screen |

**Text too small from across the room?** Use the browser's own zoom
(Ctrl and `+`). Chrome remembers it per site, and it scales the map labels
along with the interface — which is why it beats a fixed setting in the app.

**Offline behaviour:** the app shell is cached by the browser, but map tiles
stream from the internet. If the office loses connectivity the chrome, index,
and project data still render; the basemap will be blank until it's back.
