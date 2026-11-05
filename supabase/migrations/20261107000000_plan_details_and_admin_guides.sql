-- 1. Flight plan details the owner can edit from the dashboard, even after the export: flight number, aircraft, and the runways.
-- 2. Admin review of the procedures (runway guides) members saved: who, when, and a way to delete one.
--
-- Safe before the app code: it adds two nullable columns and three functions, and changes one trigger so that the primary flight
-- number can be edited through update_flight_plan_details() only (everything else stays locked on an exported plan).
-- Apply on STAGING first, then on PRODUCTION just before the release that uses it.
-- Needs 20261003000100_dashboard_drafts (the lock trigger), 20261020000000_runway_guides, 20261105000000_flight_plan_aircraft.

-- 1a. The runways of the plan: the one it departs from and the one it lands on ("08L"). NULL when not known. Kept with the plan,
-- never written into the FPL. Set by the editor (detected, or picked by the pilot) and editable from the dashboard.
ALTER TABLE public.flight_plans ADD COLUMN IF NOT EXISTS departure_runway TEXT;
ALTER TABLE public.flight_plans ADD COLUMN IF NOT EXISTS arrival_runway TEXT;
ALTER TABLE public.flight_plans DROP CONSTRAINT IF EXISTS flight_plans_departure_runway_check;
ALTER TABLE public.flight_plans DROP CONSTRAINT IF EXISTS flight_plans_arrival_runway_check;
ALTER TABLE public.flight_plans ADD CONSTRAINT flight_plans_departure_runway_check
  CHECK (departure_runway IS NULL OR departure_runway ~ '^(0[1-9]|[12][0-9]|3[0-6])[LRC]?$');
ALTER TABLE public.flight_plans ADD CONSTRAINT flight_plans_arrival_runway_check
  CHECK (arrival_runway IS NULL OR arrival_runway ~ '^(0[1-9]|[12][0-9]|3[0-6])[LRC]?$');
GRANT INSERT (departure_runway, arrival_runway) ON public.flight_plans TO authenticated;
GRANT UPDATE (departure_runway, arrival_runway) ON public.flight_plans TO authenticated;

-- 1b. The lock: an exported plan still refuses every change to its content. The primary flight number is the one field that may
-- change, and only inside update_flight_plan_details() (it raises a transaction-local flag the trigger looks for).
CREATE OR REPLACE FUNCTION public.flight_plans_stamp_save()
RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  IF OLD.status = 'exported' THEN
    IF NEW.status IS DISTINCT FROM OLD.status
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.source IS DISTINCT FROM OLD.source
       OR (NEW.flight_number IS DISTINCT FROM OLD.flight_number AND COALESCE(current_setting('app.plan_details_edit', TRUE), '') <> 'on')
       OR NEW.origin_airport IS DISTINCT FROM OLD.origin_airport
       OR NEW.destination_airport IS DISTINCT FROM OLD.destination_airport
       OR NEW.origin_airport_name IS DISTINCT FROM OLD.origin_airport_name
       OR NEW.destination_airport_name IS DISTINCT FROM OLD.destination_airport_name
       OR NEW.waypoints IS DISTINCT FROM OLD.waypoints
       OR NEW.includes_branding IS DISTINCT FROM OLD.includes_branding
       OR NEW.flight_time_minutes IS DISTINCT FROM OLD.flight_time_minutes
    THEN
      RAISE EXCEPTION 'flight_plan_locked: an exported flight plan can no longer be changed'
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.waypoints IS DISTINCT FROM OLD.waypoints OR NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.created_at := NOW();
  END IF;
  RETURN NEW;
END;
$$;

-- 1c. Edit the details of one of the caller's plans (draft or exported). Changes nothing else; created_at does not move.
CREATE OR REPLACE FUNCTION public.update_flight_plan_details(
  p_plan_id UUID,
  p_flight_number TEXT,
  p_aircraft TEXT,
  p_departure_runway TEXT,
  p_arrival_runway TEXT
)
RETURNS VOID
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  uid UUID := (SELECT auth.uid());
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_signed_in' USING ERRCODE = '28000'; END IF;
  PERFORM set_config('app.plan_details_edit', 'on', TRUE);
  UPDATE public.flight_plans f
  SET flight_number = NULLIF(btrim(p_flight_number), ''),
      aircraft = NULLIF(btrim(p_aircraft), ''),
      departure_runway = NULLIF(btrim(p_departure_runway), ''),
      arrival_runway = NULLIF(btrim(p_arrival_runway), '')
  WHERE f.id = p_plan_id AND f.user_id = uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'plan_not_found' USING ERRCODE = 'P0002'; END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.update_flight_plan_details(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_flight_plan_details(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- 2. Admin: the procedures members saved ------------------------------------------------------------------------------------
-- Every runway guide with who saved it and when, newest first (500 at most). Admins only (is_admin()).
CREATE OR REPLACE FUNCTION public.admin_list_runway_guides()
RETURNS TABLE (
  id UUID, owner_id UUID, owner_name TEXT, kind TEXT, airport TEXT, runway_name TEXT, runway_heading_deg SMALLINT,
  toc_bearing_deg SMALLINT, toc_distance_nm SMALLINT, label TEXT, points JSONB, use_count INTEGER,
  origin_sources TEXT[], source_plan_id UUID, created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  RETURN QUERY
    SELECT g.id, g.owner_id, p.discord_username, g.kind, g.airport, g.runway_name, g.runway_heading_deg,
           g.toc_bearing_deg, g.toc_distance_nm, g.label, g.points, g.use_count, g.origin_sources, g.source_plan_id, g.created_at
    FROM public.runway_guides g
    LEFT JOIN public.profiles p ON p.id = g.owner_id
    ORDER BY g.created_at DESC
    LIMIT 500;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_list_runway_guides() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_runway_guides() TO authenticated;

-- Delete one guide. Plans that used it keep their waypoints (and the origin the guide merged into them).
CREATE OR REPLACE FUNCTION public.admin_delete_runway_guide(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  DELETE FROM public.runway_guides g WHERE g.id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'guide_not_found' USING ERRCODE = 'P0002'; END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_delete_runway_guide(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_runway_guide(UUID) TO authenticated;

-- Rollback: DROP FUNCTION public.admin_delete_runway_guide(UUID); DROP FUNCTION public.admin_list_runway_guides();
-- DROP FUNCTION public.update_flight_plan_details(UUID, TEXT, TEXT, TEXT, TEXT); recreate flight_plans_stamp_save from
-- 20261003000100_dashboard_drafts.sql; ALTER TABLE public.flight_plans DROP COLUMN departure_runway, DROP COLUMN arrival_runway.
