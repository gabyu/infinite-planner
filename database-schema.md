# Database Schema for Flight Statistics

The app stores one anonymous row per flight plan (imported KML or drawn route) in Supabase.
The site uses only the public (anon) key, so access is locked down with Row Level Security.

**Never disable RLS on a table in the `public` schema.** Supabase flags it as a critical
issue because anyone with the anon key (it ships in the browser bundle) could then read,
modify and delete every row.

## Table

```sql
CREATE TABLE flight_statistics (
  id BIGSERIAL PRIMARY KEY,
  flight_number TEXT,
  origin_airport TEXT,
  destination_airport TEXT,
  flight_date TEXT,
  source TEXT, -- 'FlightRadar24', 'FlightAware' or 'DrawingBoard'
  filename TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_flight_statistics_flight_number ON flight_statistics(flight_number);
CREATE INDEX idx_flight_statistics_origin_airport ON flight_statistics(origin_airport);
CREATE INDEX idx_flight_statistics_destination_airport ON flight_statistics(destination_airport);
CREATE INDEX idx_flight_statistics_source ON flight_statistics(source);
CREATE INDEX idx_flight_statistics_created_at ON flight_statistics(created_at);
```

## Access model

- The public key can **insert** validated rows (length limits, known `source` values) and
  call the aggregate functions below. It cannot read rows directly, update or delete.
- Reads go through `SECURITY DEFINER` functions with a fixed `search_path`:
  `get_flight_count()`, `get_popular_airports(n)`, `get_popular_flights(n)`,
  `get_unique_airport_count()`. They return totals and rankings only.
- The public pages never use the `service_role` key. Only server code does: the admin API routes and the shared-plan routes (see below). Never put it in a `NEXT_PUBLIC_` variable.

The policies, grants and functions live in `supabase/migrations/`, applied in order:

1. `20261001000000_secure_public_tables_part1.sql` - RLS, validated inserts, functions
   (safe to run before the matching app code is deployed).
2. `20261001000100_secure_public_tables_part2.sql` - closes direct reads. Run it only
   after the app code using `get_flight_count()` is deployed on that environment.

If you add a new source value to the app, update the `source` check in the insert policy too,
or those inserts are silently rejected.

## Accounts and admin dashboard

Users can sign in with Discord (Supabase Auth). Site operators use a separate email/password
login at `/admin-dashboard`. Everything lives in `supabase/migrations/20261002000000_profiles_and_admin.sql`
(additive, safe to run before the app code is deployed, and it does not touch `flight_statistics`).

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  discord_username TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'user',          -- 'user' | 'admin'
  timezone TEXT,                              -- IANA name; NULL = browser-detected
  must_change_password BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

- **Row Level Security**: a signed-in user reads their own row; admins read all rows. The only
  writable column for clients is `timezone` (column-level grant), so `role` and
  `must_change_password` can't be changed from the browser. No client can insert or delete.
- **Who creates rows**: a trigger on `auth.users` creates the profile for **Discord** sign-ups only
  (role `user`). Admin accounts are created server-side (service role) by the "Create admin" action,
  or by hand for the first one (`supabase/bootstrap-first-admin.sql`).
- **`is_admin()`** is true only for `role = 'admin'` **and** `must_change_password = false`, so an admin
  with a pending temporary password has no data access until they've chosen their own.
- **Admin-only reads** are `SECURITY DEFINER` functions that check `is_admin()` themselves:
  `admin_list_admins()` (emails come from `auth.users`) and `admin_flight_export_times(since)`
  (one timestamp per exported flight plan, for the activity heatmap, bucketed per day in the
  admin's own timezone in the browser). The public key still can't read `flight_statistics`.
- **Promoting a Discord account**: "Create admin" detects an email that already belongs to a Discord account
  (`admin_lookup_user(email)`, executable by the service role only, from
  `20261002000100_admin_lookup_user.sql`) and offers to promote it. Promotion sets a temporary password
  (`auth.admin.updateUserById`) and `role = 'admin'`, `must_change_password = true`, then follows the same
  first-login flow. The Discord sign-in keeps working and the trigger never changes the role.
- **`SUPABASE_SERVICE_ROLE_KEY`** (server-only, no `NEXT_PUBLIC_` prefix) is used by the two admin API
  routes (creating an admin, finishing the first-login password change) and by the public shared-plan routes
  (see "Flight history and sharing"). Set it per Vercel environment (production key on Production, staging key
  on the `staging` environment).

## Flight history and sharing

Signed-in users' exported flight plans are stored in `flight_plans`
(`supabase/migrations/20261003000000_flight_plans.sql`, additive: it doesn't touch
`flight_statistics` or `profiles`, and is safe to run before the matching app code is deployed).

```sql
CREATE TABLE flight_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  source TEXT NOT NULL,                    -- 'FlightRadar24' | 'FlightAware' | 'Sketch'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),   -- last save of the content (UTC)
  flight_number TEXT,                      -- NULL unless the KML filename carries one reliably
  origin_airport TEXT NOT NULL,            -- ICAO
  destination_airport TEXT NOT NULL,
  origin_airport_name TEXT,                -- resolved at save time from OurAirports (see below)
  destination_airport_name TEXT,
  waypoints JSONB NOT NULL,                -- [{ name, lat, lng, altitude(ft) }], derived data only, never the KML
  includes_branding BOOLEAN NOT NULL DEFAULT TRUE,   -- were MADE/WITH/INFINITE/PLANNER in `waypoints` when saved
  flight_time_minutes INTEGER,             -- optional, entered by hand, whole minutes
  thumbnail_url TEXT,                      -- reserved, always NULL for now
  share_token UUID,                        -- NULL = not shared; unique when set
  share_download_count INTEGER NOT NULL DEFAULT 0    -- counted on shared downloads, not shown in any UI yet
);
```

- **Access**: the public key has no privileges on this table. A signed-in user can read and delete their own
  rows and insert/update their own content (RLS, `auth.uid() = user_id`). Column-level grants keep the system
  columns out of reach: `user_id` can't change after insert, `source` can't be updated, and `created_at`,
  `thumbnail_url`, `share_token` and `share_download_count` are never writable by clients. A trigger moves
  `created_at` forward only when the waypoints are saved again.
- **Saving** goes through `POST /api/flight-plans` (and `PUT /api/flight-plans/[id]` when the same editing session
  exports again). The route validates the payload, resolves the airport names on the server and writes as the
  signed-in user, so RLS still applies. At most 500 plans per user.
- **Sharing** is not a "readable if the token matches" policy. The owner starts/stops sharing with two
  `SECURITY DEFINER` functions, `share_flight_plan(plan_id)` (returns the existing token, or generates one) and
  `unshare_flight_plan(plan_id)` (sets it to NULL; sharing again makes a different token). Both only touch the
  caller's own row. The public reads a plan only through `/api/shared/[token]` (view) and
  `/api/shared/[token]/fpl` (download), which look the row up server-side by a non-null token with the service
  role. The download route calls `record_shared_download(token)`, executable by the service role only, which
  increments the counter and returns the plan in one statement. Links are live (the current saved state, not a
  snapshot) and never cached, so stopping sharing takes effect immediately.
- **`SUPABASE_SERVICE_ROLE_KEY`** is therefore also needed for shared links to resolve. Without it they fail
  closed (404).
- **Airport names** come from [OurAirports](https://ourairports.com/data/) (released to the public domain),
  filtered to 4-letter ICAO codes and bundled as `lib/data/airports.json` (about 20,000 entries, 650 KB). It is
  only imported by server code (`lib/airports.ts`), so it never reaches the browser. Regenerate it with
  `node scripts/build-airports.mjs path/to/airports.csv`. The Infinite Flight Live API is deliberately not used:
  its terms forbid keeping API data in our own database.

## Environments

Production and staging use two separate Supabase projects. Set these in Vercel, scoped to the
matching environment only (never share the production keys with Preview):

- `NEXT_PUBLIC_SUPABASE_URL`: the project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: the project's anon (publishable) key

`NEXT_PUBLIC_` values are inlined at build time, so redeploy (without build cache) after
changing them. Without them the app still runs but the statistics feature is disabled.

## Features

- Filenames of imported KML files are parsed for flight number, airports, date and source
  (FlightRadar24 / FlightAware); drawn plans are recorded with source `DrawingBoard`.
- The homepage shows total flights, unique airports, popular airports and popular flights.
