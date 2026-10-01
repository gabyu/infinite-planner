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
- The app never needs the `service_role` key. Do not put it in a `NEXT_PUBLIC_` variable.

The policies, grants and functions live in `supabase/migrations/`, applied in order:

1. `20261001000000_secure_public_tables_part1.sql` - RLS, validated inserts, functions
   (safe to run before the matching app code is deployed).
2. `20261001000100_secure_public_tables_part2.sql` - closes direct reads. Run it only
   after the app code using `get_flight_count()` is deployed on that environment.

If you add a new source value to the app, update the `source` check in the insert policy too,
or those inserts are silently rejected.

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
