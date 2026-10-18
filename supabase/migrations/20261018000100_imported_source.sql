-- Imported source: a KML that does not come from FlightRadar24 or FlightAware is an "Imported" plan, and may be shared
-- once its owner has declared the right to share it. (Before this, every KML that wasn't FlightAware was labelled
-- FlightRadar24, so plans from other sources were wrongly blocked.)
--
-- Safe before the app code: it only adds an allowed value, a column and two functions. Nothing is deleted. Plans that
-- were already saved as FlightRadar24 / FlightAware keep that origin: the file isn't stored, so a wrong label can't be
-- recovered, and an origin is never removed (the owner re-converts the file to get a correct one).

-- 1. The new value ---------------------------------------------------------------------------------------------------
ALTER TABLE public.flight_plans DROP CONSTRAINT IF EXISTS flight_plans_source_check;
ALTER TABLE public.flight_plans
  ADD CONSTRAINT flight_plans_source_check CHECK (source IN ('FlightRadar24', 'FlightAware', 'Sketch', 'Imported'));
ALTER TABLE public.flight_plans DROP CONSTRAINT IF EXISTS flight_plans_origin_sources_check;
ALTER TABLE public.flight_plans
  ADD CONSTRAINT flight_plans_origin_sources_check
  CHECK (origin_sources <@ ARRAY['FlightRadar24', 'FlightAware', 'Sketch', 'Imported']::TEXT[]);

-- 2. The allowed set now includes Imported (only where it is still the original default) -------------------------------
ALTER TABLE public.app_settings ALTER COLUMN shareable_sources SET DEFAULT ARRAY['Sketch', 'Imported']::TEXT[];
UPDATE public.app_settings SET shareable_sources = ARRAY['Sketch', 'Imported']::TEXT[]
WHERE shareable_sources = ARRAY['Sketch']::TEXT[];

-- 3. The declaration -------------------------------------------------------------------------------------------------------
-- When the owner declared the right to share an Imported plan. Server-controlled: no column grant, a copy starts without one.
ALTER TABLE public.flight_plans ADD COLUMN IF NOT EXISTS import_declared_at TIMESTAMP WITH TIME ZONE;

CREATE OR REPLACE FUNCTION public.declare_import_rights(p_plan_id UUID)
RETURNS VOID
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  uid UUID := (SELECT auth.uid());
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_signed_in' USING ERRCODE = '28000'; END IF;
  UPDATE public.flight_plans f
  SET import_declared_at = COALESCE(f.import_declared_at, NOW())
  WHERE f.id = p_plan_id AND f.user_id = uid AND f.status = 'exported' AND 'Imported' = ANY (f.origin_sources);
  IF NOT FOUND THEN RAISE EXCEPTION 'plan_not_found' USING ERRCODE = 'P0002'; END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.declare_import_rights(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.declare_import_rights(UUID) TO authenticated;

-- 4. The guard: same as 20261018000000, plus the declaration --------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.flight_plans_origin_guard()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  parent_sources TEXT[];
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.origin_sources := public.merge_origin_sources(NEW.origin_sources, ARRAY[NEW.source]);
    IF NEW.forked_from_id IS NOT NULL THEN
      SELECT o.origin_sources INTO parent_sources FROM public.flight_plans o WHERE o.id = NEW.forked_from_id;
      NEW.origin_sources := public.merge_origin_sources(NEW.origin_sources, parent_sources);
    END IF;
  ELSE
    NEW.origin_sources := public.merge_origin_sources(public.merge_origin_sources(OLD.origin_sources, NEW.origin_sources), ARRAY[NEW.source]);
  END IF;

  IF NEW.visibility = 'public'
     AND (TG_OP = 'INSERT' OR OLD.visibility IS DISTINCT FROM 'public' OR NEW.origin_sources IS DISTINCT FROM OLD.origin_sources) THEN
    IF public.is_tracker_derived(NEW.origin_sources) THEN
      RAISE EXCEPTION 'tracker_derived: only a flight plan that does not come from a tracker export can be published'
        USING ERRCODE = 'check_violation';
    END IF;
    IF 'Imported' = ANY (NEW.origin_sources) AND NEW.import_declared_at IS NULL THEN
      RAISE EXCEPTION 'declaration_required: confirm you have the right to share this flight plan'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.flight_plans_origin_guard() FROM PUBLIC, anon, authenticated;

-- Rollback: restore the trigger function from 20261018000000, drop declare_import_rights and import_declared_at,
-- set shareable_sources back to {Sketch}, and the two checks without 'Imported' (after moving any Imported plan).
