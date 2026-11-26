---
paths:
  - "lib/partners/**"
  - "config/partners.ts"
  - "app/(planner)/import/**"
  - "app/api/dev/aerohub-fixture/**"
  - "components/**/partner-banner.tsx"
  - "components/**/flight-plan-editor.tsx"
  - "public/partners/**"
  - "scripts/fixtures/aerohub-*"
---

## Partner import (AeroHub Radar, `/import`)
Link: `/import?src=aerohubradar&kml=<signed URL, URL-encoded>`. The server (never the browser) fetches the KML, only after
`lib/partners/validate-url.ts` passes it (https, exact host, path prefix, no IP/port/credentials), with no redirects, a 5 s
timeout and a 1 MB streaming limit. The geometry goes through the same `parseKML` as FR24/FlightAware; the editor gets it
as the `preloaded` prop. Nothing public about the partnership: no changelog entry, no UI text beyond the banner.
- `departure`/`arrival` are mandatory and must be known ICAO codes, else an error page (no partial import).
- `flightNumber` in the file is an **AeroHub ID**: shown with that label, never as a flight number.
- Waypoint names come from `Folder "Waypoints"` (spaces removed: `DPT RW21` -> `DPTRW21`); a point with no name keeps its number.
  The editor keeps them for AeroHub plans (`isAeroHub` in `flight-plan-editor.tsx`, `keepNames` in the naming rules).
- `TOC` and `TOD` points are dropped; runway points and oceanic fixes stay (the editor detects the runways itself).
- For an AeroHub plan the editor hides flight number, aircraft, flight time (and their chips) and the whole publishing block.
- Banner line: "Imported from AeroHub Radar • ID <id>"; the ID is the link to the flight on AeroHub (new tab) when the file's `flightUrl` is valid.
  The logo is baseline-aligned: the wordmark (not the tagline) sits on the baseline of the airports (`WORDMARK_BASELINE` in `partner-banner.tsx`).
- Logo (`config/partners.ts` -> `logo`): only in the import banner (top right of the route row, `PartnerLogo`), black file on
  light, white on dark, 20 px high (`heightPx`; the authorization asks for 24 px or more, Gab chose 20 on 2026-11-15 so it clears the panel's collapse button), files in `public/partners/aerohubradar/` kept byte for byte (do not run SVGO or
  recolour). Shown only while the partner is `enabled`. Terms of the partner's signed authorization (2026-11-06): nowhere else
  (not home, footer or navigation), no wording of endorsement or official status. A partner/resources section is for later.
- Plans are saved with source `AeroHub` (tracker-style, not shareable). Needs `supabase/migrations/20261110000000_aerohub_source.sql`
  on staging, then prod, before anyone saves such a plan.
- Tracking: one JSON log line per import (`partner_import`, path only, never `exp`/`sig`) and one `partner_import_downloaded`
  line, joined by `importId` (Vercel runtime logs). No table.
- Local test (`pnpm dev`, port 3000): the `aerohubradar-dev` partner exists only when `NODE_ENV=development` and serves
  `scripts/fixtures/aerohub-QR520-YPPH-EGLL.kml` from `app/api/dev/aerohub-fixture/`:
  `http://localhost:3000/import?src=aerohubradar-dev&kml=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fdev%2Faerohub-fixture%2Fqr520.kml`
  (`expired.kml` answers 410).
- Tests: `pnpm test:aerohub-parser`, `pnpm test:aerohub-rules`, `pnpm test:partner-url`, `pnpm test:import-fetch`.

