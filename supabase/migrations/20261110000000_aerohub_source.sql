-- AeroHub Radar source: a plan opened through /import (partner link) is stored with source 'AeroHub'.
-- It is a tracker-style source: it is NOT in app_settings.shareable_sources, so is_tracker_derived() treats it like
-- FlightRadar24 / FlightAware and the plan cannot be published.
--
-- Safe before the app code: it only widens two CHECK constraints. Nothing is deleted or rewritten.
-- Apply to staging first, prod just before release.

ALTER TABLE public.flight_plans DROP CONSTRAINT IF EXISTS flight_plans_source_check;
ALTER TABLE public.flight_plans
  ADD CONSTRAINT flight_plans_source_check CHECK (source IN ('FlightRadar24', 'FlightAware', 'AeroHub', 'Sketch', 'Imported'));
ALTER TABLE public.flight_plans DROP CONSTRAINT IF EXISTS flight_plans_origin_sources_check;
ALTER TABLE public.flight_plans
  ADD CONSTRAINT flight_plans_origin_sources_check
  CHECK (origin_sources <@ ARRAY['FlightRadar24', 'FlightAware', 'AeroHub', 'Sketch', 'Imported']::TEXT[]);

-- Runway guides carry the origin set of the plan they come from (see 20261020000000_runway_guides.sql), so they accept it too.
-- The inline CHECK on that column has the default name below.
ALTER TABLE public.runway_guides DROP CONSTRAINT IF EXISTS runway_guides_origin_sources_check;
ALTER TABLE public.runway_guides
  ADD CONSTRAINT runway_guides_origin_sources_check CHECK (
    cardinality(origin_sources) > 0
    AND origin_sources <@ ARRAY['FlightRadar24', 'FlightAware', 'AeroHub', 'Sketch', 'Imported']::TEXT[]
  );

-- Rollback: move any 'AeroHub' plan to another source first, then restore the three checks from 20261018000100.
