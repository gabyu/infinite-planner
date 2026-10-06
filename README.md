# Infinite Planner

**The Flight Plan Hub for [Infinite Flight](https://infiniteflight.com).** Convert a real-world flight into a ready-to-use flight plan, or draw one from scratch. Sign in with Discord to keep, share and reuse your plans.

🌐 **Production:** [infiniteplanner.gabyu.com](https://infiniteplanner.gabyu.com)

| Page | What it does |
|---|---|
| [/convert](https://infiniteplanner.gabyu.com/convert) | Import a KML file from FlightRadar24 or FlightAware and turn it into an Infinite Flight plan. |
| [/sketch](https://infiniteplanner.gabyu.com/sketch) | **Route Sketch**: draw a route on a blank map with Line and Pen tools, then export it the same way. Desktop only. |
| [/dashboard](https://infiniteplanner.gabyu.com/dashboard) | Your personal dashboard: activity graph, drafts and exported flights (signed in). |
| `/shared/<token>` | A public, read-only page for a plan someone shared: map, details, download. No account needed. |

## Features

### Convert a real flight
- Reads FlightRadar24 and FlightAware KML files and detects the source automatically.
- Filters unnecessary waypoints, keeping only the essential turns, and caps the plan at Infinite Flight's limit (250 waypoints).
- Custom waypoint naming with a pattern (e.g. `AFKLM028-###`).
- Reads the flight number from the KML's file name when it can be done reliably (never guessed).
- Interactive map with a **Select Points** mode: drag a box around waypoints to select and delete them in one tap. Works on phones and tablets.
- Exports a ready-to-use **FPL** file.

### Route Sketch
- **Line** tool for straight legs, **Pen** tool (Illustrator-style: click for a corner, click-and-drag for a curve) for sweeping turns.
- **Selection** tool to move anchors and curve handles afterward, with full undo/redo.
- Curves are baked into extra waypoints, since Infinite Flight only flies waypoint to waypoint.

### Accounts (optional)
Nothing requires an account. Signed out, Convert and Sketch work exactly as before and nothing is saved.

- **Sign in with Discord** from the header; your Discord username is your public identity on the site.
- **Dashboard**: a graph of your plans over the last year and **My flights**, newest first, with source, flight number, airports and flight time.
- **Drafts**: your plan is autosaved while you edit (on closing the map in Convert, once the route has two points and both airports in Sketch, then every minute). Reopen a draft with **Edit**.
- **Exported plans are final**: you can view, re-download, share, **Duplicate** (creates a new, unshared draft) or delete them. Only the generated plan is stored, never the imported KML.
- **Share links**: one click creates a public link anyone can open. It always shows the plan as it is now, shows the author's Discord username, and **Stop sharing** switches it off immediately. Sharing again makes a brand new link.
- **Rich previews**: a shared link pasted in Discord, Slack or X shows a card with the route, the airports, the flight number and time, and an image of the route.
- Optional **flight time** and a **"Made with Infinite Planner"** checkbox (names four waypoints before the destination) next to Export.

### Also
- Homepage counters and rankings (popular airports, unique airports, flights analyzed), fed by both Convert and Sketch.
- GDPR-compliant cookie consent for Google Analytics, plus [Terms](https://infiniteplanner.gabyu.com/terms), [Privacy](https://infiniteplanner.gabyu.com/privacy) and [Cookie](https://infiniteplanner.gabyu.com/cookies) pages.

### Admin dashboard
A small back office at `/admin-dashboard` (separate sign-in, not linked from the site): activity overview, user list, admin management (an admin creates other admins, who must change their temporary password on first login) and per-admin timezone.

## Roadmap
- Identify step climbs, mark TOC (Top of Climb) and TOD (Top of Descent).
- Round altitudes to the nearest 100 ft.
- A touch-friendly way to draw a route on phones and tablets.

## Environments

| | Branch | Database | Notes |
|---|---|---|---|
| **Production** | `main` | Supabase project (prod) | Live site. |
| **Staging** | `staging` | Supabase project (staging) | Separate database; `noindex`, used by testers. |
| **Local** | any | Either project, or your own | `pnpm dev`. |

Workflow: feature branches merge into `staging`; `staging` is merged into `main` only once verified. Both deploy automatically on Vercel. The two Supabase projects are fully separate, so **every migration must be applied to each one**.

## Tech stack
Next.js 14 (App Router), React, TypeScript, Tailwind CSS, Radix UI / shadcn, Leaflet, Supabase (Postgres + Auth with Discord), Vercel.

## Running locally

```bash
git clone https://github.com/gabyu/infinite-planner.git
cd infinite-planner
pnpm install
# create .env.local with the variables below
pnpm dev
```

### Environment variables

| Variable | Scope | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | public | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | Supabase publishable (anon) key. |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only, secret** | Used by the admin and shared-plan API routes. Never prefix it with `NEXT_PUBLIC_`. |
| `NEXT_PUBLIC_ENV` | public | Set to `staging` on staging (adds `noindex` and the staging OpenGraph URL). Leave unset in production. |

On Vercel, scope each set to its environment: production variables to Production, staging ones to the `staging` branch only (not the general Preview environment).

## Database (Supabase)

Row Level Security is enabled everywhere and must **never** be disabled: the anon key ships in the browser bundle. The public key can only insert validated statistics rows and call aggregate functions; everything else goes through the signed-in user's own rows or server-side routes using the service role key. Details in [database-schema.md](database-schema.md).

1. Apply the files of [supabase/migrations](supabase/migrations) **in order** (SQL Editor or Supabase CLI).
2. Authentication → Providers → enable **Discord** and add the callback URL of the environment (`<site>/auth/callback`) to the redirect allow-list.
3. Create the first admin, once per environment, by following [supabase/bootstrap-first-admin.sql](supabase/bootstrap-first-admin.sql). After that, admins are created from the admin dashboard.

## Releasing

1. Work on a feature branch, merge into `staging`, check it on the staging site.
2. Apply any new migration to the **staging** database first, then to **prod** just before the release.
3. Merge `staging` into `main`; Vercel deploys production.
4. Add the user-facing changes to [CHANGELOG.md](CHANGELOG.md).

## Contributing
Try it and let me know if it works as expected. If you can improve the code, feel free to fork it. 🚀
