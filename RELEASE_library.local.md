# Release notes: public flight plan library (Routes / Explore)

Local file (gitignored, like the other `*.local.md`). Branch `feature/library` (off `staging`, 6 steps, not pushed).
Brief: `~/Downloads/library-brief.md`. Status 2026-10-14: built; staging DB migrated; **production untouched**.

## Read before anything ships

1. **Data rights (brief section 8).** Publishing routes derived from FlightRadar24 / FlightAware conversions is a legal
   grey area (their terms restrict redistribution of their data). Staging only until Gabriel confirms. The Terms ask
   publishers to confirm they have the right to publish, but that does not settle it.
2. **The Terms of Service, Privacy Policy and FAQ were rewritten** (`app/terms`, `app/privacy`, `app/faq`). They need a
   human read. The avatar is now shown on shared/published plans (the old texts said it never was); profiles, likes,
   downloads, reports, public indexing and cache lag are covered. No contact details were invented
   (`lib/legal.ts` CONTACT_EMAIL is the existing one). `LEGAL_LAST_UPDATED` is October 14, 2026: set it to the release day.
3. The CHANGELOG entry sits under "Unreleased" and says the library opens only at launch. The code never publishes
   or announces anything; no e-mail or notification is sent. Communication is manual.

## What was built (one commit per step on the branch)

1. Foundation: visibility (private / unlisted / public), public ids, plan pages `/explore/plans/{origin}-{dest}[-{flight}]-{id}`
   (ISR, 5 min, tag revalidation), route renderer, legacy `/shared/{token}` 308 redirect, robots, sitemap, launch flag.
2. Likes, per-user download counting (login required after launch), import (fork), stats endpoint, sign-in intents.
3. `/explore` (search, sort, filters, keyset paging), route and airport hubs, related plans, Explore nav link.
4. Pilot profiles, featured plans, publish consent, dashboard tabs and library cards, Public visibility.
5. Reports, admin **Routes** section, Public from the Convert/Sketch share dialog, legal / FAQ / changelog.
6. Launch switch: admin **Settings** card (progress counter, editable target, "Launch to everyone").

Deviations from the brief: the brief had no sections 2-3 ("decision 5" read as "download needs login after launch");
plan URL moved to `/explore/plans/` at Gabriel's request; `/explore` and the hubs are rendered per request (they read
the session for the pre-launch gate), only plan pages are ISR; the Convert/Sketch publish control is the existing Share
dialog (with Public), not a separate collapsible section; Explore link for admins before launch appears after the
session loads.

## Production deployment order (brief 13.5)

Migrations, in order (`supabase/migrations/`), all additive, `library_launched` defaults to FALSE:

```
20261015000000_plan_library_foundation.sql
20261015000100_plan_library_actions.sql
20261015000200_plan_library_listing.sql   (superseded in part by ...0300: list_public_plans is dropped/re-created there; applying both in order is fine)
20261015000300_plan_library_profiles.sql
20261015000400_plan_library_moderation.sql
20261015000500_plan_library_launch.sql
```

Prerequisite: the production DB must already have the history/share migrations (`flight_plans`, `status`, link-discord).
Note the migration list shown by the Supabase MCP on staging does not include them (they were applied by hand), so check
production's tables, not its migration list.

1. Apply the 6 migrations in production. The previous app version keeps working (nothing was dropped or renamed).
2. Merge/deploy the code. `SUPABASE_SERVICE_ROLE_KEY` must be set on the production Vercel environment (the plan pages
   read through the service role). Verify as a non-admin: nothing visible changed except old `/shared/...` links, which
   now redirect to `/explore/plans/...` (unlisted).
3. Admins (production accounts, with a **linked Discord profile**: an admin without a Discord name gets "Link your Discord
   account to publish") publish about 50-60 plans with the normal Convert / Sketch flow and the Public choice. Check with
   an anonymous browser that public plan URLs return 404 and `sitemap.xml` has no library URLs.
4. Admin dashboard > **Settings** > Library launch: when the counter reaches the target, **Launch to everyone**.
   It revalidates the `library` tag (every cached library page, the header link, the sitemap); no deploy.

## Emergency rollback of the launch

```sql
UPDATE public.app_settings SET library_launched = FALSE WHERE id;
```

Pages refresh within about 5 minutes on their own (or at once if a deploy/redeploy clears the data cache). There is no
un-launch button on purpose. Hiding a single plan: admin Routes > Hide.

## Staging state (2026-10-14)

- All six migrations applied to staging (`oaxmshcqxhdapompired`). `app_settings.library_launched = TRUE` for QA.
- Four old shared plans are `unlisted`; no public plan, no report. Test rows from development were reverted.
- Local dev points at the staging DB.

## Checked on a production build against staging data

- Flag OFF, anonymous: `/explore`, hubs, `/pilots/*`, public plan page, its preview image, download and stats all 404;
  sitemap empty; no Explore link; an unlisted legacy link redirects, shows `noindex`, no like/import island, downloads
  anonymously (new URL and legacy API both 200).
- Flag ON, anonymous: library pages 200; public plan `index, follow` with breadcrumb data; unlisted `noindex`; every
  download 401 (new URL, unlisted, legacy API); sitemap lists `/explore`, hubs and public plans; Explore link shown.
- DB functions run as impersonated users (rolled back): likes / import idempotency, own-plan refusals, featured limits,
  profile exposes no e-mail / role / private plans, report once, admin functions refuse non-admins, hide stops serving,
  blocked authors can't publish, launch is idempotent and admin-only.

## Not tested (needs a Discord / admin session): do these on local dev or with Raphaël on staging

- Signed-in flows through the browser: like / download / import and the sign-in intent replay, Open my copy, the fork
  opening in Convert's map view, dashboard tabs and library cards, consent and featured dialogs, profile page.
- Admin: the Routes page actions, the Settings card and the live flip (does the header link appear and does the sitemap
  fill without a redeploy after pressing Launch?), the admin pre-launch preview rewrite (`/explore/plans/*` -> `/preview/...`).
- Lighthouse (mobile, both themes, 375px) on a plan page: not run.
- Raphael's QA list (brief section 11) applies as written.
