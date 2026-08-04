# Deploying the Kalb Project Atlas to Vercel

The app is a static site (HTML/JS/CSS — no server), so Vercel hosts it for
free and redeploys automatically whenever the repo changes.

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

### 3. Add the Mapbox token
Still on the import screen (or later under **Settings → Environment
Variables**), add:

| Name | Value | Environments |
|---|---|---|
| `VITE_MAPBOX_TOKEN` | `pk.…` (from account.mapbox.com) | Production, Preview, Development |

Without it the site still works — it falls back to the free map engine — but
with it you get the smooth vector map, 3D city view, and lighting presets.

> The token is compiled into the public JavaScript bundle. That's normal for
> Mapbox `pk.` tokens, but **restrict it**: Mapbox → Access tokens → your
> token → **URL restrictions** → add your Vercel domain (and
> `http://localhost:5173` for local work).

### 4. Deploy
Click **Deploy**. First build takes ~1–2 minutes and you get a URL like
`kalb-projects-wall-map.vercel.app`.

### 5. Pick the branch Vercel builds
By default Vercel deploys the repo's default branch. This work currently
lives on `claude/kalb-construction-wall-map-4ifnh8`, so either:
- merge that branch into `main` (recommended once you're happy with it), or
- **Settings → Git → Production Branch** → set it to
  `claude/kalb-construction-wall-map-4ifnh8`.

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

**Offline behaviour:** the app shell is cached by the browser, but map tiles
stream from the internet. If the office loses connectivity the chrome, index,
and project data still render; the basemap will be blank until it's back.
