-- Legal and compliance correctif: an origin mark that cannot be lost, a server-side block on publishing plans
-- that come from a tracker export, and the moderation trail (where a report was made, who hid a plan and when).
--
-- Safe to run BEFORE the matching app code: the only things that change behaviour are the new block on
-- publishing (the old app gets the same friendly refusal through the existing error path) and the privatising of
-- plans that were already public and are tracker-derived (step 4). Nothing is deleted: no plan, share token,
-- report or history row is removed.
--
-- Order inside this file: column -> backfill -> helper functions -> privatise -> guard trigger -> publish
-- function -> reports -> moderation log. The backfill and the privatising run before the trigger exists on purpose.

-- 1. The allowed set -----------------------------------------------------------------------------------------------
-- Sources whose plans may be shared or published. Only plans designed in Infinite Planner (source 'Sketch').
-- A future "publishable_sources" may be narrower than this list, never wider.
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS shareable_sources TEXT[] NOT NULL DEFAULT ARRAY['Sketch']::TEXT[];

-- 2. The origin mark -----------------------------------------------------------------------------------------------
-- The set of sources a plan comes from. Alongside `source`, never replacing it. Server-controlled: no column grant.
ALTER TABLE public.flight_plans
  ADD COLUMN IF NOT EXISTS origin_sources TEXT[] NOT NULL DEFAULT '{}'::TEXT[];
ALTER TABLE public.flight_plans DROP CONSTRAINT IF EXISTS flight_plans_origin_sources_check;
ALTER TABLE public.flight_plans
  ADD CONSTRAINT flight_plans_origin_sources_check
  CHECK (origin_sources <@ ARRAY['FlightRadar24', 'FlightAware', 'Sketch']::TEXT[]);

-- Union of two sets: distinct, sorted, never NULL.
CREATE OR REPLACE FUNCTION public.merge_origin_sources(a TEXT[], b TEXT[])
RETURNS TEXT[]
LANGUAGE sql IMMUTABLE SET search_path = ''
AS $$
  SELECT COALESCE(array_agg(DISTINCT s ORDER BY s), '{}'::TEXT[])
  FROM unnest(COALESCE(a, '{}'::TEXT[]) || COALESCE(b, '{}'::TEXT[])) AS s;
$$;

-- 3. Backfill: every plan gets its own source plus, for copies, the sources of every ancestor ------------------------
WITH RECURSIVE chain AS (
  SELECT f.id AS plan_id, f.source, f.forked_from_id, 1 AS depth
  FROM public.flight_plans f
  UNION ALL
  SELECT c.plan_id, o.source, o.forked_from_id, c.depth + 1
  FROM chain c
  JOIN public.flight_plans o ON o.id = c.forked_from_id
  WHERE c.depth < 20
),
origins AS (
  SELECT plan_id, public.merge_origin_sources(array_agg(source), '{}') AS sources
  FROM chain GROUP BY plan_id
)
UPDATE public.flight_plans f
SET origin_sources = o.sources
FROM origins o
WHERE o.plan_id = f.id AND f.origin_sources = '{}'::TEXT[];

-- 4. Helpers ---------------------------------------------------------------------------------------------------------
-- The allowed set, read from the settings row. Falls back to Sketch only (fail closed) if the row is missing.
CREATE OR REPLACE FUNCTION public.shareable_sources()
RETURNS TEXT[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT COALESCE((SELECT s.shareable_sources FROM public.app_settings s WHERE s.id), ARRAY['Sketch']::TEXT[]);
$$;
REVOKE EXECUTE ON FUNCTION public.shareable_sources() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shareable_sources() TO authenticated;

-- THE rule: a plan is tracker-derived when its origin set holds a source outside the allowed set. An empty set
-- counts as derived (an unknown origin is never shared). Used by the guard trigger, set_plan_visibility and the app.
CREATE OR REPLACE FUNCTION public.is_tracker_derived(p_origin_sources TEXT[])
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT cardinality(COALESCE(p_origin_sources, '{}'::TEXT[])) = 0
         OR NOT (p_origin_sources <@ public.shareable_sources());
$$;
REVOKE EXECUTE ON FUNCTION public.is_tracker_derived(TEXT[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_tracker_derived(TEXT[]) TO authenticated;

-- 5. Close the paths that already exist ----------------------------------------------------------------------------------
-- A plan that is public today and tracker-derived goes back to private (same fields set_plan_visibility('private')
-- changes). The row, its public id and its history are kept. Pages cached for it are dropped by revalidation, see the
-- release notes.
-- What each one looked like is kept first, so the change can be read back or undone by hand.
CREATE TABLE IF NOT EXISTS public.legal_privatised_plans (
  plan_id UUID PRIMARY KEY REFERENCES public.flight_plans (id) ON DELETE CASCADE,
  previous_published_at TIMESTAMP WITH TIME ZONE,
  previous_featured BOOLEAN NOT NULL,
  privatised_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
ALTER TABLE public.legal_privatised_plans ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.legal_privatised_plans FROM anon, authenticated;

INSERT INTO public.legal_privatised_plans (plan_id, previous_published_at, previous_featured)
SELECT f.id, f.published_at, f.featured
FROM public.flight_plans f
WHERE f.visibility = 'public' AND public.is_tracker_derived(f.origin_sources)
ON CONFLICT (plan_id) DO NOTHING;

UPDATE public.flight_plans f
SET visibility = 'private', published_at = NULL, featured = FALSE
WHERE f.visibility = 'public' AND public.is_tracker_derived(f.origin_sources);

-- 6. The guard: no way in, whatever the caller (function, API route, service role, SQL editor) ----------------------------
CREATE OR REPLACE FUNCTION public.flight_plans_origin_guard()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  parent_sources TEXT[];
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- A new plan carries its own source, and (a copy) every origin of the plan it was copied from.
    NEW.origin_sources := public.merge_origin_sources(NEW.origin_sources, ARRAY[NEW.source]);
    IF NEW.forked_from_id IS NOT NULL THEN
      SELECT o.origin_sources INTO parent_sources FROM public.flight_plans o WHERE o.id = NEW.forked_from_id;
      NEW.origin_sources := public.merge_origin_sources(NEW.origin_sources, parent_sources);
    END IF;
  ELSE
    -- An origin is never removed: whatever an update says, the old set stays in.
    NEW.origin_sources := public.merge_origin_sources(public.merge_origin_sources(OLD.origin_sources, NEW.origin_sources), ARRAY[NEW.source]);
  END IF;

  IF NEW.visibility = 'public'
     AND (TG_OP = 'INSERT' OR OLD.visibility IS DISTINCT FROM 'public' OR NEW.origin_sources IS DISTINCT FROM OLD.origin_sources)
     AND public.is_tracker_derived(NEW.origin_sources) THEN
    RAISE EXCEPTION 'tracker_derived: only a flight plan designed in Infinite Planner can be published'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.flight_plans_origin_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS flight_plans_origin_guard ON public.flight_plans;
CREATE TRIGGER flight_plans_origin_guard
  BEFORE INSERT OR UPDATE ON public.flight_plans
  FOR EACH ROW EXECUTE FUNCTION public.flight_plans_origin_guard();

-- 7. set_plan_visibility: same function as 20261015000600, with the origin check first -------------------------------------
CREATE OR REPLACE FUNCTION public.set_plan_visibility(p_plan_id UUID, p_visibility TEXT)
RETURNS TABLE (public_id TEXT, visibility TEXT)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  uid UUID := (SELECT auth.uid());
  plan public.flight_plans%ROWTYPE;
  parent_hash TEXT;
  publications INTEGER;
  max_publications CONSTANT INTEGER := 20;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not_signed_in' USING ERRCODE = '28000';
  END IF;
  IF p_visibility NOT IN ('private', 'public') THEN
    RAISE EXCEPTION 'invalid_visibility' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO plan FROM public.flight_plans f WHERE f.id = p_plan_id AND f.user_id = uid FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'plan_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF plan.status <> 'exported' THEN
    RAISE EXCEPTION 'plan_not_exported: only an exported flight plan can be made public' USING ERRCODE = 'check_violation';
  END IF;

  IF p_visibility = 'public' THEN
    IF public.is_tracker_derived(plan.origin_sources) THEN
      RAISE EXCEPTION 'tracker_derived: only a flight plan designed in Infinite Planner can be published' USING ERRCODE = 'check_violation';
    END IF;
    IF EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = uid AND p.publishing_blocked) THEN
      RAISE EXCEPTION 'publishing_blocked' USING ERRCODE = 'insufficient_privilege';
    END IF;
    IF plan.is_fork AND plan.forked_from_id IS NOT NULL THEN
      SELECT o.waypoints_hash INTO parent_hash FROM public.flight_plans o WHERE o.id = plan.forked_from_id;
      IF parent_hash IS NOT NULL AND parent_hash = COALESCE(plan.waypoints_hash, public.plan_waypoints_hash(plan.waypoints)) THEN
        RAISE EXCEPTION 'unchanged_fork: change the route before publishing it' USING ERRCODE = 'check_violation';
      END IF;
    END IF;
    IF plan.visibility <> 'public' THEN
      SELECT count(*) INTO publications
      FROM public.plan_publication_log l WHERE l.user_id = uid AND l.at > NOW() - INTERVAL '24 hours';
      IF publications >= max_publications THEN
        RAISE EXCEPTION 'rate_limited: too many publications today' USING ERRCODE = 'check_violation';
      END IF;
      INSERT INTO public.plan_publication_log (user_id, plan_id) VALUES (uid, plan.id);
    END IF;
  END IF;

  UPDATE public.flight_plans f
  SET visibility = p_visibility,
      -- The public id (and so the address) is kept when a plan goes private and comes back.
      public_id = CASE WHEN p_visibility = 'private' THEN f.public_id ELSE COALESCE(f.public_id, public.generate_public_id()) END,
      published_at = CASE WHEN p_visibility = 'public' THEN COALESCE(f.published_at, NOW()) ELSE NULL END,
      featured = CASE WHEN p_visibility = 'public' THEN f.featured ELSE FALSE END,
      distance_nm = COALESCE(f.distance_nm, public.plan_distance_nm(f.waypoints)),
      max_altitude_ft = COALESCE(f.max_altitude_ft, public.plan_max_altitude_ft(f.waypoints)),
      waypoints_hash = COALESCE(f.waypoints_hash, public.plan_waypoints_hash(f.waypoints))
  WHERE f.id = plan.id
  RETURNING f.public_id, f.visibility INTO public_id, visibility;

  RETURN NEXT;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.set_plan_visibility(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_plan_visibility(UUID, TEXT) TO authenticated;

-- 8. Reports: remember the page the report was made from ------------------------------------------------------------------
ALTER TABLE public.plan_reports
  ADD COLUMN IF NOT EXISTS page_url TEXT CHECK (page_url IS NULL OR char_length(page_url) <= 300);

-- The old 3-argument version goes: with the new optional argument a named 3-argument call would be ambiguous.
-- The previous app version keeps working, it just doesn't send the address.
DROP FUNCTION IF EXISTS public.report_flight_plan(TEXT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.report_flight_plan(
  p_public_id TEXT, p_reason TEXT, p_details TEXT DEFAULT NULL, p_page_url TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  uid UUID := (SELECT auth.uid());
  plan public.flight_plans;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_signed_in' USING ERRCODE = '28000'; END IF;
  IF p_reason NOT IN ('inappropriate', 'copyright', 'wrong_data', 'spam', 'other') THEN
    RAISE EXCEPTION 'invalid_reason' USING ERRCODE = '22023';
  END IF;
  plan := public.actionable_plan(p_public_id);
  IF plan.id IS NULL THEN RAISE EXCEPTION 'plan_not_found' USING ERRCODE = 'P0002'; END IF;
  IF plan.user_id = uid THEN RAISE EXCEPTION 'own_plan' USING ERRCODE = 'check_violation'; END IF;

  -- A second report from the same person about the same plan, while the first is still open, is a no-op.
  INSERT INTO public.plan_reports (plan_id, reporter_id, reason, details, page_url)
  VALUES (plan.id, uid, p_reason, NULLIF(LEFT(btrim(COALESCE(p_details, '')), 500), ''),
          NULLIF(LEFT(btrim(COALESCE(p_page_url, '')), 300), ''))
  ON CONFLICT (reporter_id, plan_id) WHERE resolved_at IS NULL DO NOTHING;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.report_flight_plan(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_flight_plan(TEXT, TEXT, TEXT, TEXT) TO authenticated;

DROP FUNCTION IF EXISTS public.admin_list_reports();
CREATE FUNCTION public.admin_list_reports()
RETURNS TABLE (
  id UUID, created_at TIMESTAMP WITH TIME ZONE, reason TEXT, details TEXT, reporter_name TEXT,
  plan_id UUID, public_id TEXT, origin_airport TEXT, destination_airport TEXT, flight_number TEXT,
  moderation_status TEXT, author_id UUID, author_name TEXT, page_url TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT r.id, r.created_at, r.reason, r.details, COALESCE(rp.discord_username, 'Infinite Planner admin'),
         f.id, f.public_id, f.origin_airport, f.destination_airport, f.flight_number, f.moderation_status,
         ap.id, COALESCE(ap.discord_username, 'Infinite Planner admin'), r.page_url
  FROM public.plan_reports r
  JOIN public.flight_plans f ON f.id = r.plan_id
  JOIN public.profiles rp ON rp.id = r.reporter_id
  JOIN public.profiles ap ON ap.id = f.user_id
  WHERE (SELECT public.is_admin()) AND r.resolved_at IS NULL
  ORDER BY r.created_at
  LIMIT 200;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_list_reports() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_reports() TO authenticated;

-- 9. Hiding is logged: who, when, which plan, and the report that led to it ------------------------------------------------
CREATE TABLE IF NOT EXISTS public.plan_moderation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.flight_plans (id) ON DELETE CASCADE,
  admin_id UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('hide', 'unhide')),
  report_id UUID REFERENCES public.plan_reports (id) ON DELETE SET NULL,
  at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_plan_moderation_log_plan ON public.plan_moderation_log (plan_id, at DESC);
ALTER TABLE public.plan_moderation_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.plan_moderation_log FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_plan_moderation(p_plan_id UUID, p_status TEXT)
RETURNS TEXT
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  result TEXT;
  previous TEXT;
BEGIN
  IF NOT (SELECT public.is_admin()) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = 'insufficient_privilege'; END IF;
  IF p_status NOT IN ('ok', 'hidden') THEN RAISE EXCEPTION 'invalid_status' USING ERRCODE = '22023'; END IF;
  SELECT f.moderation_status INTO previous FROM public.flight_plans f WHERE f.id = p_plan_id;
  -- A hidden plan is no longer featured.
  UPDATE public.flight_plans f
  SET moderation_status = p_status, featured = CASE WHEN p_status = 'hidden' THEN FALSE ELSE f.featured END
  WHERE f.id = p_plan_id
  RETURNING f.public_id INTO result;
  IF NOT FOUND THEN RAISE EXCEPTION 'plan_not_found' USING ERRCODE = 'P0002'; END IF;
  IF previous IS DISTINCT FROM p_status THEN
    INSERT INTO public.plan_moderation_log (plan_id, admin_id, action)
    VALUES (p_plan_id, (SELECT auth.uid()), CASE WHEN p_status = 'hidden' THEN 'hide' ELSE 'unhide' END);
  END IF;
  RETURN result;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_set_plan_moderation(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_plan_moderation(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_resolve_report(p_report_id UUID, p_hide BOOLEAN DEFAULT FALSE)
RETURNS TEXT
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  target UUID;
  was_hidden BOOLEAN;
  result TEXT;
BEGIN
  IF NOT (SELECT public.is_admin()) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = 'insufficient_privilege'; END IF;
  SELECT r.plan_id INTO target FROM public.plan_reports r WHERE r.id = p_report_id AND r.resolved_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'report_not_found' USING ERRCODE = 'P0002'; END IF;

  IF p_hide THEN
    SELECT f.moderation_status = 'hidden' INTO was_hidden FROM public.flight_plans f WHERE f.id = target;
    UPDATE public.flight_plans f SET moderation_status = 'hidden', featured = FALSE WHERE f.id = target;
    IF NOT COALESCE(was_hidden, FALSE) THEN
      INSERT INTO public.plan_moderation_log (plan_id, admin_id, action, report_id)
      VALUES (target, (SELECT auth.uid()), 'hide', p_report_id);
    END IF;
    UPDATE public.plan_reports r SET resolved_at = NOW(), resolved_by = (SELECT auth.uid())
    WHERE r.plan_id = target AND r.resolved_at IS NULL;
  ELSE
    UPDATE public.plan_reports r SET resolved_at = NOW(), resolved_by = (SELECT auth.uid()) WHERE r.id = p_report_id;
  END IF;
  SELECT f.public_id INTO result FROM public.flight_plans f WHERE f.id = target;
  RETURN result;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_resolve_report(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_resolve_report(UUID, BOOLEAN) TO authenticated;

-- Rollback (keeps all data):
--   DROP TRIGGER flight_plans_origin_guard ON public.flight_plans; DROP FUNCTION public.flight_plans_origin_guard();
--   re-create set_plan_visibility from 20261015000600, admin_set_plan_moderation / admin_resolve_report /
--   admin_list_reports / report_flight_plan from 20261015000400;
--   then optionally DROP TABLE public.plan_moderation_log; ALTER TABLE public.plan_reports DROP COLUMN page_url;
--   ALTER TABLE public.flight_plans DROP COLUMN origin_sources; ALTER TABLE public.app_settings DROP COLUMN shareable_sources;
--   DROP FUNCTION public.is_tracker_derived(TEXT[]), public.shareable_sources(), public.merge_origin_sources(TEXT[], TEXT[]).
-- (The plans that step 5 made private stay private; make them public again by hand only if that is what you want.)
