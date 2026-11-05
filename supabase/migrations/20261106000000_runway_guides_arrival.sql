-- Runway guides, second kind: the ARRIVAL. A guide is a path in a runway's frame; a departure runs from the line-up point to
-- the top of climb, an arrival from the start of the arrival to the touchdown point. Same table, same privacy (a guide is only
-- ever visible to the person who saved it), same origin rules (the guide carries its plan's origin set, which only grows).
--
-- For an arrival the columns toc_bearing_deg / toc_distance_nm hold the bearing and distance from the runway threshold to the
-- START of the arrival (where the plan comes from), the way a departure holds them for the top of climb.
--
-- Safe before the app code: it only widens a CHECK and replaces one function (the old call, without p_kind, still works and
-- means 'departure'). Needs 20261020000000_runway_guides.
-- Apply on STAGING first, then on PRODUCTION just before the release that uses it.

-- 1. The table accepts both kinds ------------------------------------------------------------------------------------------
ALTER TABLE public.runway_guides DROP CONSTRAINT IF EXISTS runway_guides_kind_check;
ALTER TABLE public.runway_guides ADD CONSTRAINT runway_guides_kind_check CHECK (kind IN ('departure', 'arrival'));

-- 2. Saving takes the kind (default 'departure', so nothing that calls it today changes) ------------------------------------
DROP FUNCTION IF EXISTS public.save_runway_guide(UUID, TEXT, TEXT, INTEGER, INTEGER, INTEGER, JSONB, TEXT);

CREATE OR REPLACE FUNCTION public.save_runway_guide(
  p_plan_id UUID,
  p_airport TEXT,
  p_runway_name TEXT,
  p_runway_heading INTEGER,
  p_toc_bearing INTEGER,
  p_toc_distance INTEGER,
  p_points JSONB,
  p_label TEXT DEFAULT NULL,
  p_kind TEXT DEFAULT 'departure'
)
RETURNS UUID
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  uid UUID := (SELECT auth.uid());
  plan_origins TEXT[];
  guide_id UUID;
  max_guides CONSTANT INTEGER := 300;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_signed_in' USING ERRCODE = '28000'; END IF;
  IF p_kind IS NULL OR p_kind NOT IN ('departure', 'arrival') THEN RAISE EXCEPTION 'invalid_kind' USING ERRCODE = '22023'; END IF;
  IF NOT public.is_valid_guide_points(p_points) THEN RAISE EXCEPTION 'invalid_points' USING ERRCODE = '22023'; END IF;

  SELECT f.origin_sources INTO plan_origins FROM public.flight_plans f WHERE f.id = p_plan_id AND f.user_id = uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'plan_not_found' USING ERRCODE = 'P0002'; END IF;
  -- An unknown origin is never shared: a plan without a recorded origin cannot be the source of a guide.
  IF plan_origins IS NULL OR cardinality(plan_origins) = 0 THEN RAISE EXCEPTION 'unknown_origin' USING ERRCODE = 'check_violation'; END IF;

  IF (SELECT count(*) FROM public.runway_guides g WHERE g.owner_id = uid) >= max_guides
     AND NOT EXISTS (SELECT 1 FROM public.runway_guides g WHERE g.owner_id = uid AND g.kind = p_kind AND g.airport = p_airport
                     AND g.points_hash = md5(p_points::TEXT)) THEN
    RAISE EXCEPTION 'too_many_guides' USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.runway_guides (
    owner_id, kind, airport, runway_name, runway_heading_deg, toc_bearing_deg, toc_distance_nm, label,
    points, points_hash, source_plan_id, origin_sources
  ) VALUES (
    uid, p_kind, p_airport, NULLIF(p_runway_name, ''), p_runway_heading, p_toc_bearing, p_toc_distance, NULLIF(btrim(p_label), ''),
    p_points, md5(p_points::TEXT), p_plan_id, plan_origins
  )
  ON CONFLICT (owner_id, kind, airport, points_hash) DO UPDATE
    SET origin_sources = public.merge_origin_sources(public.runway_guides.origin_sources, EXCLUDED.origin_sources),
        label = COALESCE(EXCLUDED.label, public.runway_guides.label)
  RETURNING id INTO guide_id;
  RETURN guide_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.save_runway_guide(UUID, TEXT, TEXT, INTEGER, INTEGER, INTEGER, JSONB, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_runway_guide(UUID, TEXT, TEXT, INTEGER, INTEGER, INTEGER, JSONB, TEXT, TEXT) TO authenticated;

-- Rollback (only while no arrival guide exists, else delete those rows first): DELETE FROM public.runway_guides WHERE kind = 'arrival';
-- ALTER TABLE public.runway_guides DROP CONSTRAINT runway_guides_kind_check; ALTER TABLE public.runway_guides ADD CONSTRAINT
-- runway_guides_kind_check CHECK (kind IN ('departure')); then recreate save_runway_guide from 20261020000000_runway_guides.sql.
