-- Admin: correct a procedure (runway guide) a member saved. A guide saved from an import the detection could not read has no runway, or
-- the wrong one; an admin picks the right runway and direction in Admin -> Procedures -> Saved by members -> Edit.
-- Changes the runway label and heading, the direction (toc_bearing_deg) and, when the runway changes, the path re-expressed in the
-- new runway's frame (the app computes it). The owner, the origin and the use count are untouched.
--
-- Safe before the app code: it adds one function. Needs 20261020000000_runway_guides and 20261107000000_plan_details_and_admin_guides.
-- Apply on STAGING first, then on PRODUCTION just before the release that uses it.
-- Rollback: DROP FUNCTION public.admin_update_runway_guide(UUID, TEXT, INTEGER, INTEGER, JSONB);
CREATE OR REPLACE FUNCTION public.admin_update_runway_guide(
  p_id UUID,
  p_runway_name TEXT,
  p_runway_heading INTEGER,
  p_toc_bearing INTEGER,
  p_points JSONB
)
RETURNS VOID
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF NOT public.is_valid_guide_points(p_points) THEN RAISE EXCEPTION 'invalid_points' USING ERRCODE = '22023'; END IF;
  -- The table's CHECK constraints refuse a malformed runway name, heading or bearing.
  UPDATE public.runway_guides g
  SET runway_name = NULLIF(btrim(p_runway_name), ''),
      runway_heading_deg = p_runway_heading,
      toc_bearing_deg = p_toc_bearing,
      points = p_points,
      points_hash = md5(p_points::TEXT)
  WHERE g.id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'guide_not_found' USING ERRCODE = 'P0002'; END IF;
EXCEPTION
  -- The owner already has this very path saved for this airport.
  WHEN unique_violation THEN RAISE EXCEPTION 'duplicate_guide' USING ERRCODE = '23505';
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_update_runway_guide(UUID, TEXT, INTEGER, INTEGER, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_runway_guide(UUID, TEXT, INTEGER, INTEGER, JSONB) TO authenticated;
