# Infinite Planner: context for Claude

Flight-plan hub for Infinite Flight (Next.js). Converts FlightRadar24/FlightAware KML into `.fpl`,
draws routes from scratch (Route Sketch), and has Discord sign-in, a dashboard, share links, an
admin back office, and live Infinite Flight features (airport/runway/procedure cards).
Production: https://infiniteplanner.gabyu.com. Owner: Gab. GitHub: `gabyu/infinite-planner`.
Product description and feature list: [README.md](README.md). Do not repeat it here.

## Stack and commands
Next.js 14 App Router, React, TypeScript, Tailwind, Radix/shadcn, Leaflet, Supabase (Postgres + Auth
with Discord), Vercel. Package manager: **pnpm**.

```bash
pnpm install
pnpm dev                 # http://localhost:3000 (launch config: .claude/launch.json)
pnpm lint
pnpm check:copy          # copy-review guard, runs before every non-prod build
pnpm check:seo
pnpm test:<name>         # route-phases, runway-choice, runway-wind, weather, procedures, ... (see package.json)
```

## Layout
- `app/` routes (`(planner)/convert`, `sketch`, `dashboard`, `explore`, admin dashboard, API routes)
- `components/` (`ds/` design-system primitives, `dashboard/`, `home/`), `hooks/`, `lib/`
- `supabase/migrations/` 26 SQL files, applied in order; `supabase/bootstrap-first-admin.sql`
- `scripts/` tests and data builders (`build-airport-data.mjs`, `build-airports.mjs`, `build-globe-land.mjs`)
- `content/` guides and FAQ text
- Design rules: [DESIGN.md](DESIGN.md) and [design-system.md](design-system.md). Follow them for any UI change.
- Database and RLS: [database-schema.md](database-schema.md)
- Copy approvals: `copy-review-*.md`. UI copy is reviewed per page; `check-copy.mjs` fails the build on unapproved markers.
- User-facing changes go in [CHANGELOG.md](CHANGELOG.md).

## Environments and workflow
| | Branch | Database |
|---|---|---|
| Production | `main` | Supabase prod project |
| Staging | `staging` | separate Supabase staging project, `noindex` |

- Feature branches merge into `staging`; `staging` merges into `main` only after verification. Vercel deploys both.
- **Every migration must be applied to both Supabase projects**, staging first, prod just before release.
- Push to GitHub with the explicit URL (`git push https://github.com/gabyu/infinite-planner.git main`)
  as the rollout notes do. A remote `origin` over SSH also exists.
- Do not push, deploy, or touch a Supabase/Vercel project without Gab's go-ahead.
- Never disable Row Level Security: the anon key ships in the browser bundle.

## Gotchas
- The service-role key and `IF_API_KEY` are server-only. Never prefix them `NEXT_PUBLIC_`, log them, or bundle them.
- `LIVE_API_ENABLED=false` kills every live Infinite Flight feature; `LIVE_REQUIRES_ROLE` gates live card and procedures to admin/contributor.
- Infinite Flight flies waypoint to waypoint only, so curves are baked into extra waypoints. Plans cap at 250 waypoints.
- Exported plans are final. Only the generated plan is stored, never the imported KML.
- Real tracker KMLs in `test-kml/` and everything `*.local.*` are gitignored on purpose. Never commit them.
- `pnpm-workspace.yaml` and `.claude/` are machine-specific and gitignored.
- One commit deleted `components/dashboard/library-overview.tsx` by mistake and it was restored. Check imports before deleting.

## Local-only files (not in git, back up with ~/Dev)
`.env.local`, `STAGING.local.md` (staging setup, includes credentials), `STAGING_CHANGELOG.local.md`,
`PROD_ROLLOUT.local.md`, `PROD_MIGRATIONS*.local.sql`, `RELEASE_*.local.md` (per-feature release notes,
useful history), `test-kml/`. Treat the `.local.md` files as sensitive.

## Status (2026-11-04)
Active. Branch `staging`: the procedures feature, shared plans, admin nav/users and the new pages were committed on
2026-11-04 (not pushed yet). Runway tiles are small (wind detail only for the selected runway); the procedure list shows
the picked runway only, with dates and a Restore for the original departure. Staging is pushed up to `ab32ff6` and deployed. The airport procedures migration is already on the staging Supabase
project and NOT yet on prod. Prod go-live plan: `PROD_ROLLOUT_2026-11.local.md`. Approve the PROVISIONAL strings in
`lib/copy.ts` first (they block production builds only), `public/images/zaidee.webp` is untracked and unreferenced.
The production rollout of accounts, dashboard and sharing was prepared 2026-10-05 (see `PROD_ROLLOUT.local.md`); confirm
with Gab how far it got before assuming anything is live.

See also: [RESTORE.md](RESTORE.md).
