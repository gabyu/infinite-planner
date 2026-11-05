# Restore: Infinite Planner

## Prerequisites
```bash
brew install node pnpm gh
cd ~/Dev/infinite-planner && pnpm install
```
`pnpm-workspace.yaml` is machine-specific (build-approval config). If pnpm asks to approve build scripts, run `pnpm approve-builds`.

## Secrets: `.env.local` (gitignored, copy came back with ~/Dev; if lost, recreate)
| Name | Where to get it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase dashboard, project (staging or prod) > Settings > API |
| `SUPABASE_SERVICE_ROLE_KEY` | same page, `service_role`. Server only. |
| `IF_API_KEY` | Infinite Flight Live API key, one per environment |
| `NEXT_PUBLIC_CARTO_BASEMAPS_KEY` | Carto basemaps account |
| `NEXT_PUBLIC_ENV` | `staging` on staging, unset in prod |
| `PROCEDURES_DIR` | local folder of KMLs for `/dev/procedures`; optional |

Local dev should point at the **staging** Supabase project, not prod.

## External services (nothing here runs locally)
- **GitHub**: `gabyu/infinite-planner`. Run `gh auth login`, `ssh -T git@github.com`.
- **Vercel**: project `infinite-planner`; production on `main`, staging on branch `staging` (domain assigned to that branch only). Env vars are scoped per environment there. Setup details: `STAGING.local.md`.
- **Supabase**: two projects (prod, staging). Migrations in `supabase/migrations/`, applied in order. First admin per environment: `supabase/bootstrap-first-admin.sql` (use an edited copy, never commit it).
- **Discord app**: provides sign-in. Client ID and secret live in the Supabase Auth provider settings; redirect list needs `<site>/auth/callback`.
- **Domains**: `infiniteplanner.gabyu.com` and the staging domain, via the DNS of `gabyu.com`.

## Local-only files git does not carry
`.env.local`, `STAGING.local.md`, `STAGING_CHANGELOG.local.md`, `PROD_ROLLOUT.local.md`, `PROD_MIGRATIONS*.local.sql`, `RELEASE_*.local.md`, `test-kml/`. They are in `~/Dev`, so a `~/Dev` backup covers them.

## Branches
Local branches (many `feature/*`) exist only if they were pushed or are in the `~/Dev` copy. Run `git fetch --all` and `git status` after restoring. Uncommitted work on `staging` was present at backup time.

## Checklist
- [ ] `pnpm dev` starts on http://localhost:3000
- [ ] Homepage counters load (Supabase reachable)
- [ ] Convert: import a KML, export an `.fpl`
- [ ] Sign in with Discord works locally (redirect allow-list includes localhost)
- [ ] `pnpm lint` and `pnpm check:copy` pass
- [ ] `git push --dry-run` works
