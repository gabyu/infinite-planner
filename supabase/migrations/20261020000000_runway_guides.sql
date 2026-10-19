-- Runway guides: a reusable path tied to one runway end, saved from a flight plan's departure (later: arrival and approach).
-- This migration is the PRIVATE part: a guide is only ever visible to the person who saved it. Sharing a guide with the
-- community is a separate, later migration, after the legal read.
--
-- Rules it keeps (see the plan in the repository's release notes):
--   * A guide is derived from a flight plan, so it carries that plan's origin set (public.merge_origin_sources), which only
--     grows. A guide from a tracker-derived plan can therefore never be shared later (public.is_tracker_derived).
--   * Using a guide on a plan merges the guide's origin into that plan, so a plan built on a tracker-derived guide cannot be
--     published either (apply_runway_guides).
--   * Nothing here reads Infinite Flight data. A guide is the user's own plan geometry.
--
-- Safe before the app code: it adds a table and three functions, changes nothing that exists, deletes nothing.
-- Needs 20261018000000_legal_compliance (merge_origin_sources) and the plan columns it added.

-- 1. Path validation, used by the table's CHECK and the save function -------------------------------------------------
-- A path is [[along_m, across_m, altitude_ft], ...]: 3 to 60 points, each three numbers, within 80 km of the runway end,
-- altitude between -1000 and 60000 ft. Anything else is refused whatever the caller says.
CREATE OR REPLACE FUNCTION public.is_valid_guide_points(p_points JSONB)
RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_points IS NULL OR jsonb_typeof(p_points) <> 'array' THEN FALSE
    WHEN jsonb_array_length(p_points) NOT BETWEEN 3 AND 60 THEN FALSE
    WHEN octet_length(p_points::TEXT) > 6000 THEN FALSE
    ELSE NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_points) AS e
      WHERE NOT (
        CASE WHEN jsonb_typeof(e) = 'array' AND jsonb_array_length(e) = 3
              AND jsonb_typeof(e -> 0) = 'number' AND jsonb_typeof(e -> 1) = 'number' AND jsonb_typeof(e -> 2) = 'number'
          THEN abs((e ->> 0)::NUMERIC) <= 80000 AND abs((e ->> 1)::NUMERIC) <= 80000 AND (e ->> 2)::NUMERIC BETWEEN -1000 AND 60000
          ELSE FALSE END
      )
    )
  END;
$$;

-- 2. The table ------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.runway_guides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  -- Only departures for now; arrival and approach guides widen this later.
  kind TEXT NOT NULL DEFAULT 'departure' CHECK (kind IN ('departure')),
  airport TEXT NOT NULL CHECK (airport ~ '^[A-Z]{4}$'),
  -- The runway end the path starts from ("28L"). NULL when it could not be told and the owner did not assign one.
  runway_name TEXT CHECK (runway_name IS NULL OR runway_name ~ '^(0[1-9]|[12][0-9]|3[0-6])[LRC]?$'),
  -- True heading of that end in whole degrees (from the airport data), NULL when unknown.
  runway_heading_deg SMALLINT CHECK (runway_heading_deg IS NULL OR runway_heading_deg BETWEEN 0 AND 359),
  -- Where the path was heading: bearing and distance from the runway end to the top of climb (the real one, even when the
  -- stored path stops at 40 NM).
  toc_bearing_deg SMALLINT NOT NULL CHECK (toc_bearing_deg BETWEEN 0 AND 359),
  toc_distance_nm SMALLINT NOT NULL CHECK (toc_distance_nm BETWEEN 0 AND 1000),
  label TEXT CHECK (label IS NULL OR char_length(label) <= 40),
  -- The path in the runway's frame (see is_valid_guide_points). Derived data only, never a KML.
  points JSONB NOT NULL CHECK (public.is_valid_guide_points(points)),
  -- Dedupes the same path saved twice by the same person.
  points_hash TEXT NOT NULL,
  source_plan_id UUID REFERENCES public.flight_plans (id) ON DELETE SET NULL,
  -- Where the path comes from, kept through every copy and never shrinking: the plan's set at save time, plus whatever
  -- the same path was saved from later. Server-controlled: no column grant.
  origin_sources TEXT[] NOT NULL CHECK (
    cardinality(origin_sources) > 0 AND origin_sources <@ ARRAY['FlightRadar24', 'FlightAware', 'Sketch', 'Imported']::TEXT[]
  ),
  use_count INTEGER NOT NULL DEFAULT 0 CHECK (use_count >= 0),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (owner_id, kind, airport, points_hash)
);

CREATE INDEX IF NOT EXISTS idx_runway_guides_owner_airport ON public.runway_guides (owner_id, airport);

-- 3. Access: a person reads and deletes their own guides, nothing else; writes go through the functions below ---------------
ALTER TABLE public.runway_guides ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.runway_guides FROM anon, authenticated;
GRANT SELECT, DELETE ON public.runway_guides TO authenticated;

DROP POLICY IF EXISTS "Read own runway guides" ON public.runway_guides;
DROP POLICY IF EXISTS "Delete own runway guides" ON public.runway_guides;
CREATE POLICY "Read own runway guides" ON public.runway_guides
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = owner_id);
CREATE POLICY "Delete own runway guides" ON public.runway_guides
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = owner_id);

-- 4. Save a guide from one of the caller's plans -------------------------------------------------------------------------------
-- The origin set comes from the plan row, never from the caller. Saving the same path again returns the existing guide
-- (and adds the new plan's origin to it, so the set still only grows). At most 300 guides per person.
CREATE OR REPLACE FUNCTION public.save_runway_guide(
  p_plan_id UUID,
  p_airport TEXT,
  p_runway_name TEXT,
  p_runway_heading INTEGER,
  p_toc_bearing INTEGER,
  p_toc_distance INTEGER,
  p_points JSONB,
  p_label TEXT DEFAULT NULL
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
  IF NOT public.is_valid_guide_points(p_points) THEN RAISE EXCEPTION 'invalid_points' USING ERRCODE = '22023'; END IF;

  SELECT f.origin_sources INTO plan_origins FROM public.flight_plans f WHERE f.id = p_plan_id AND f.user_id = uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'plan_not_found' USING ERRCODE = 'P0002'; END IF;
  -- An unknown origin is never shared: a plan without a recorded origin cannot be the source of a guide.
  IF plan_origins IS NULL OR cardinality(plan_origins) = 0 THEN RAISE EXCEPTION 'unknown_origin' USING ERRCODE = 'check_violation'; END IF;

  IF (SELECT count(*) FROM public.runway_guides g WHERE g.owner_id = uid) >= max_guides
     AND NOT EXISTS (SELECT 1 FROM public.runway_guides g WHERE g.owner_id = uid AND g.kind = 'departure' AND g.airport = p_airport
                     AND g.points_hash = md5(p_points::TEXT)) THEN
    RAISE EXCEPTION 'too_many_guides' USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.runway_guides (
    owner_id, kind, airport, runway_name, runway_heading_deg, toc_bearing_deg, toc_distance_nm, label,
    points, points_hash, source_plan_id, origin_sources
  ) VALUES (
    uid, 'departure', p_airport, NULLIF(p_runway_name, ''), p_runway_heading, p_toc_bearing, p_toc_distance, NULLIF(btrim(p_label), ''),
    p_points, md5(p_points::TEXT), p_plan_id, plan_origins
  )
  ON CONFLICT (owner_id, kind, airport, points_hash) DO UPDATE
    SET origin_sources = public.merge_origin_sources(public.runway_guides.origin_sources, EXCLUDED.origin_sources),
        label = COALESCE(EXCLUDED.label, public.runway_guides.label)
  RETURNING id INTO guide_id;
  RETURN guide_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.save_runway_guide(UUID, TEXT, TEXT, INTEGER, INTEGER, INTEGER, JSONB, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_runway_guide(UUID, TEXT, TEXT, INTEGER, INTEGER, INTEGER, JSONB, TEXT) TO authenticated;

-- 5. Use guides on a plan ------------------------------------------------------------------------------------------------------
-- Merges the guides' origins into the plan (the guard trigger keeps the union: an origin is never removed), and counts the use.
-- Only the caller's own draft plan and the caller's own guides. Returns the plan's origin set after the merge.
CREATE OR REPLACE FUNCTION public.apply_runway_guides(p_plan_id UUID, p_guide_ids UUID[])
RETURNS TEXT[]
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  uid UUID := (SELECT auth.uid());
  merged TEXT[];
  found_ids INTEGER;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_signed_in' USING ERRCODE = '28000'; END IF;
  IF p_guide_ids IS NULL OR cardinality(p_guide_ids) = 0 OR cardinality(p_guide_ids) > 10 THEN
    RAISE EXCEPTION 'invalid_guides' USING ERRCODE = '22023';
  END IF;

  SELECT count(*) INTO found_ids FROM public.runway_guides g WHERE g.id = ANY (p_guide_ids) AND g.owner_id = uid;
  IF found_ids <> cardinality(ARRAY(SELECT DISTINCT unnest(p_guide_ids))) THEN RAISE EXCEPTION 'guide_not_found' USING ERRCODE = 'P0002'; END IF;

  PERFORM 1 FROM public.flight_plans f WHERE f.id = p_plan_id AND f.user_id = uid AND f.status = 'draft' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'plan_not_draft' USING ERRCODE = 'P0002'; END IF;

  SELECT public.merge_origin_sources('{}'::TEXT[], COALESCE(array_agg(DISTINCT s), '{}'::TEXT[]))
  INTO merged
  FROM public.runway_guides g, unnest(g.origin_sources) AS s
  WHERE g.id = ANY (p_guide_ids) AND g.owner_id = uid;

  UPDATE public.flight_plans f
  SET origin_sources = public.merge_origin_sources(f.origin_sources, merged)
  WHERE f.id = p_plan_id AND f.user_id = uid
  RETURNING f.origin_sources INTO merged;

  UPDATE public.runway_guides g SET use_count = g.use_count + 1 WHERE g.id = ANY (p_guide_ids) AND g.owner_id = uid;
  RETURN merged;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.apply_runway_guides(UUID, UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_runway_guides(UUID, UUID[]) TO authenticated;

-- Rollback: DROP FUNCTION public.apply_runway_guides(UUID, UUID[]); DROP FUNCTION public.save_runway_guide(UUID, TEXT, TEXT,
-- INTEGER, INTEGER, INTEGER, JSONB, TEXT); DROP TABLE public.runway_guides; DROP FUNCTION public.is_valid_guide_points(JSONB).
-- Plans keep any origin a guide merged into them: an origin is never removed.
