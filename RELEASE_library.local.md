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
20261015000600_plan_library_simplify.sql   (private/public only; WITHDRAWS every old share link; see below)
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

## Changes of 2026-10-14 (after the first staging push)

- **Two visibilities, not three**: private or public. "Unlisted" and the old share links are gone. The migration
  `...000600` sends every unlisted/shared plan back to private, clears all share tokens and drops the share functions.
  **In production this destroys every existing `/shared/...` link** (they 404). Say so in the announcement.
  Before the launch, non-admin users have no way to publish (no Share button any more: the Visibility switch only
  appears once the library is open to them), so nothing replaces the old links until launch day.
- A **Visibility switch** (private/public, with copy-link and "feature on profile") replaces the Share button in the
  dashboard rows and in the editor. First switch to public asks for the consent.
- `/how-it-works` and `/faq` redirect (308) to **/help**; one "Help" entry in the header. The FAQ entries about Explore
  I wrote earlier were in a dead copy of the FAQ data (the page renders `components/faq-selector.tsx`): they are now there.
- The map screen of Convert is called the **flight plan editor**.
- `/explore/airports/{icao}` became `/explore/location/KPHX`; new `/explore/flight_number/AF69` (a flight-number search
  such as `AF69` jumps to it). Both use UPPERCASE codes; other cases redirect (308). Route hubs stay lowercase.
- Cards: creation date, no source, land dots under the route, route coloured by altitude with the homepage ramp (also on
  the plan page map and the link preview image). A plan without altitude gets no altitude figure or graph and a single
  route colour. The source filter is gone from Explore.
- `/explore` is laid out like a magazine (cover story, trending, latest, more).

## Contributor role (2026-10-15)

- Migration `20261016000000_contributor_role.sql` (apply after the six library migrations): `profiles.role` accepts
  `contributor`, new `contributor_since`, `viewer_role()` / `has_library_preview()`, admin functions to list, find,
  raise and demote, and the badge in `get_pilot_profile` and `get_public_plan`.
- A contributor can use the library before the launch (Explore, plan pages, the Visibility switch, likes, imports) like an
  admin, but has no admin space: `is_admin()` and the admin middleware are unchanged. After the launch they keep the role
  as a badge.
- Admin > **Contributors**: search a Discord member by name, **Make contributor**; the list shows since / published plans /
  downloads / likes, and **Demote**. Admins can't be raised or demoted from there. Demoting does not unpublish plans: before
  the launch a demoted account simply loses access to the library (its public plans 404 for non-admins like any other).
- Seeding in production: apply the migration, deploy, then raise the chosen members from the Contributors tab.

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
