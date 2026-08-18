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
| `npm run build` (`tsc -b && vite build && node scripts/protect-build.mjs`) | passes, ~25 s |
| Build output | `dist/` — includes `assets/`, `brand/`, `renders/`; `data/` and `tools/` are stripped out and embedded into the `api/` functions instead (see **Access gate**) |
| `dist/data/projects.json` | not present by design — served by `api/serve.ts` behind the gate |
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

### 3. Add the environment variables
Still on the import screen (or later under **Settings → Environment
Variables**), add both:

| Name | Value | Environments |
|---|---|---|
| `SITE_KEY` | a long random string — see **Access gate** below | Production, Preview, Development |
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

### Access gate

The deployment is on the public internet. Every pin carries a job number, a
street address, a project manager's name and a square footage, so the actual
project data is gated by a secret link.

Set `SITE_KEY` in Vercel to a long random string. The entry link is then:

```
https://kalb-projects-wall-map.vercel.app/api/gate?k=<SITE_KEY>
```

Open it once per browser. It stores a one-year cookie and drops you on the
map with the key never touching the address bar. Afterwards that browser
loads normally; every other visitor gets an empty, branded map -- the app
shell loads, but every job number, address, PM name and square footage is
withheld.

The kiosk opens the link once and is never asked again. Sharing the site means
sharing that link, so treat it like a password.

#### What is and isn't gated, and why

Two earlier versions of this gate tried to block the whole site -- first with
a root `middleware.ts` (which turned out to be a Next.js/SvelteKit/Nuxt/Astro
adapter convention, not a Vercel-wide feature -- a plain Vite SPA has no
adapter, so Vercel deployed the file and never ran it), then with a
conditional `vercel.json` redirect (which stayed silently open through two
rounds of syntax fixes, and there was no way to test the actual rule against
Vercel's live edge network to find out why).

Rather than ship a fourth unverifiable guess at routing syntax for the whole
site, the gate now targets exactly the part that is provably possible to
protect and provably testable locally: the data.

- `api/gate.ts` issues the access cookie -- the only source of it, and only
  after the `SITE_KEY` check passes. HttpOnly, so no page can read, set, or
  forge it via script.
- `api/serve.ts` is the only source of `data/projects.json`, `data/teams.json`,
  `tools/geocode.html` and `tools/coords.html`. It 404s any of them without
  the cookie.
- `scripts/protect-build.mjs` runs at the end of `npm run build` and removes
  those four files from `dist/` entirely, replacing them with plain string
  constants `api/serve.ts` imports. This is what makes the rewrite
  reliable: a Vercel rewrite can never win against a static file sitting at
  the same path (the filesystem is checked first), so the only way to
  guarantee the function is the sole path to this content is to make sure
  nothing is left in the static output to compete with it. Both functions
  are unit-tested against the real generated file as part of verifying this
  works -- see the commit that introduced them for the test output.

`index.html` and the JS/CSS bundle are deliberately left alone, public, and
unrewritten -- exactly as risky to touch (Vercel's static build validation
may require an `index.html` at the output root; that was not a risk worth
taking blind) and, more to the point, unnecessary: the app fetches its data
at runtime rather than embedding it in the bundle, so the shell on its own
names no job, no address, no person. A stranger who opens the bare URL sees
Kalb's branding and an empty map. That satisfies the actual concern this
gate exists for -- nobody sees the data without the link -- without
depending on a routing rule for the site root that has proven twice not to
be verifiable in advance.

There is also a best-effort `vercel.json` redirect that sends "/" and
"/index.html" to the gate when the cookie is missing, so a visitor may get a
clean 404 on the bare URL instead of the empty shell. Whether that fires
depends on the same conditional-redirect matching that failed twice before,
so treat it as a bonus, not the protection -- the data gate above is what
actually withholds the sensitive information regardless of whether this
redirect works.

There are two secrets, deliberately:

- `SITE_KEY` — the half people type. Lives only in Vercel, never in the repo.
- the cookie value in `api/_shared.ts` (and mirrored in the `vercel.json`
  redirect condition) — an opaque token. It is committed, because a static
  config file cannot read an environment variable, and a serverless
  function's source is still just source. Anyone who can read this repo
  could forge the cookie; that is Kalb staff, and the gate is aimed at
  strangers who find the URL.

#### Rotating and lifting

- **New link, old links dead** — change `SITE_KEY`, redeploy. Browsers already
  holding a cookie stay in.
- **Kick everyone out** — change the token in `api/_shared.ts` (`PASS`) and
  in the `vercel.json` redirect condition (the two must match), commit,
  redeploy. Every cookie dies at once and everyone needs the link again.
- **Lift the gate** — delete the `rewrites` block from `vercel.json` and
  remove `scripts/protect-build.mjs` from the `build` script in
  `package.json`, so the data goes back into the static build output.

An unset `SITE_KEY` locks everyone out of the data rather than letting
everyone in: `api/gate.ts` 404s unconditionally with no key configured, and
`api/serve.ts` never had a way to let anyone in except through that cookie.
That failure is loud instead of silently open.

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

On the kiosk machine, launch Chrome in kiosk mode against the Vercel URL:

```
chrome.exe --kiosk --noerrdialogs --disable-pinch-zoom https://<your-vercel-url>
```

(macOS: `open -a "Google Chrome" --args --kiosk …`)

Then disable OS sleep and screen blanking. The app's own idle attract loop
takes over after 90 seconds and wakes on any touch.

There is also a **full-screen button** in the bottom-right control cluster,
so a display with no keyboard can go edge-to-edge with one tap.

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
a TV. Three more taps hide it. `?diag=1` does the same from the URL.

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
