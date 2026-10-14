-- Public flight plan library, step 2 (community actions): likes, per-user download counting,
-- import (fork), and the small read functions the plan page's client island uses.
--
-- Additive; safe before the matching app code. The public-facing functions take the plan's PUBLIC id
-- (the id in its URL), never its database id.
--
-- Counts are derived from the tables, not incremented blindly: a user repeating an action changes
-- nothing, acting on your own plan counts for nothing, anonymous traffic is never counted.

-- Resolves a public id to a plan the caller may act on (not private, not hidden, exported).
CREATE OR REPLACE FUNCTION public.actionable_plan(p_public_id TEXT)
RETURNS public.flight_plans
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT f FROM public.flight_plans f
  WHERE f.public_id = p_public_id AND f.visibility <> 'private' AND f.moderation_status = 'ok' AND f.status = 'exported';
$$;
REVOKE EXECUTE ON FUNCTION public.actionable_plan(TEXT) FROM PUBLIC, anon, authenticated;

-- Like / unlike, idempotent: sets the state asked for. Returns the state and the new count.
CREATE OR REPLACE FUNCTION public.set_plan_like(p_public_id TEXT, p_liked BOOLEAN)
RETURNS TABLE (liked BOOLEAN, like_count INTEGER)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  uid UUID := (SELECT auth.uid());
  plan public.flight_plans;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_signed_in' USING ERRCODE = '28000'; END IF;
  plan := public.actionable_plan(p_public_id);
  IF plan.id IS NULL THEN RAISE EXCEPTION 'plan_not_found' USING ERRCODE = 'P0002'; END IF;
  IF plan.user_id = uid THEN RAISE EXCEPTION 'own_plan: you can''t like your own flight plan' USING ERRCODE = 'check_violation'; END IF;

  IF p_liked THEN
    INSERT INTO public.plan_likes (user_id, plan_id) VALUES (uid, plan.id) ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.plan_likes l WHERE l.user_id = uid AND l.plan_id = plan.id;
  END IF;

  UPDATE public.flight_plans f
  SET like_count = (SELECT count(*) FROM public.plan_likes l WHERE l.plan_id = plan.id)
  WHERE f.id = plan.id
  RETURNING f.like_count INTO like_count;

  liked := p_liked;
  RETURN NEXT;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.set_plan_like(TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_plan_like(TEXT, BOOLEAN) TO authenticated;

-- Import: copies the plan into a new private DRAFT of the caller and records the lineage. Idempotent:
-- if the caller already has a copy, that one is returned (no second fork, no second count).
CREATE OR REPLACE FUNCTION public.import_flight_plan(p_public_id TEXT)
RETURNS TABLE (plan_id UUID, created BOOLEAN)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  uid UUID := (SELECT auth.uid());
  src public.flight_plans;
  existing UUID;
  owned INTEGER;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_signed_in' USING ERRCODE = '28000'; END IF;
  src := public.actionable_plan(p_public_id);
  IF src.id IS NULL THEN RAISE EXCEPTION 'plan_not_found' USING ERRCODE = 'P0002'; END IF;
  IF src.user_id = uid THEN RAISE EXCEPTION 'own_plan: this is already your flight plan' USING ERRCODE = 'check_violation'; END IF;

  SELECT f.id INTO existing FROM public.flight_plans f
  WHERE f.user_id = uid AND f.forked_from_id = src.id ORDER BY f.created_at DESC LIMIT 1;
  IF existing IS NOT NULL THEN
    plan_id := existing; created := FALSE;
    RETURN NEXT; RETURN;
  END IF;

  -- Same cap as saving from the editor (MAX_FLIGHT_PLANS_PER_USER).
  SELECT count(*) INTO owned FROM public.flight_plans f WHERE f.user_id = uid;
  IF owned >= 500 THEN RAISE EXCEPTION 'dashboard_full' USING ERRCODE = 'check_violation'; END IF;

  INSERT INTO public.flight_plans (
    user_id, source, status, flight_number, origin_airport, destination_airport,
    origin_airport_name, destination_airport_name, waypoints, includes_branding, flight_time_minutes,
    forked_from_id, is_fork, visibility
  ) VALUES (
    uid, src.source, 'draft', src.flight_number, src.origin_airport, src.destination_airport,
    src.origin_airport_name, src.destination_airport_name, src.waypoints, src.includes_branding, src.flight_time_minutes,
    src.id, TRUE, 'private'
  ) RETURNING id INTO plan_id;

  -- Distinct users who hold a copy.
  UPDATE public.flight_plans f
  SET import_count = (SELECT count(DISTINCT c.user_id) FROM public.flight_plans c WHERE c.forked_from_id = src.id)
  WHERE f.id = src.id;

  created := TRUE;
  RETURN NEXT;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.import_flight_plan(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_flight_plan(TEXT) TO authenticated;

-- Download by a signed-in user (service role, called by the route after it verified the session):
-- returns the file's content and records the user's first download of the plan. Not counted for the
-- plan's own author.
CREATE OR REPLACE FUNCTION public.record_plan_download(p_public_id TEXT, p_user_id UUID)
RETURNS TABLE (origin_airport TEXT, destination_airport TEXT, flight_number TEXT, waypoints JSONB)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  plan public.flight_plans;
BEGIN
  plan := public.actionable_plan(p_public_id);
  IF plan.id IS NULL THEN RETURN; END IF;

  IF plan.user_id <> p_user_id THEN
    INSERT INTO public.plan_downloads (user_id, plan_id) VALUES (p_user_id, plan.id) ON CONFLICT DO NOTHING;
    UPDATE public.flight_plans f
    SET download_count = (SELECT count(*) FROM public.plan_downloads d WHERE d.plan_id = plan.id)
    WHERE f.id = plan.id;
  END IF;

  origin_airport := plan.origin_airport;
  destination_airport := plan.destination_airport;
  flight_number := plan.flight_number;
  waypoints := plan.waypoints;
  RETURN NEXT;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.record_plan_download(TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_plan_download(TEXT, UUID) TO service_role;

-- What the island shows: the counters (service role, no-store) ...
CREATE OR REPLACE FUNCTION public.get_plan_stats(p_public_id TEXT)
RETURNS TABLE (like_count INTEGER, import_count INTEGER, download_count INTEGER)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT f.like_count, f.import_count, f.download_count
  FROM public.flight_plans f
  WHERE f.public_id = p_public_id AND f.visibility <> 'private' AND f.moderation_status = 'ok' AND f.status = 'exported';
$$;
REVOKE EXECUTE ON FUNCTION public.get_plan_stats(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_plan_stats(TEXT) TO service_role;

-- ... and what is true for the signed-in viewer: do they own it, like it, hold a copy.
CREATE OR REPLACE FUNCTION public.get_plan_viewer_state(p_public_id TEXT)
RETURNS TABLE (plan_id UUID, is_owner BOOLEAN, liked BOOLEAN, copy_id UUID)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT CASE WHEN f.user_id = (SELECT auth.uid()) THEN f.id END,
         f.user_id = (SELECT auth.uid()),
         EXISTS (SELECT 1 FROM public.plan_likes l WHERE l.plan_id = f.id AND l.user_id = (SELECT auth.uid())),
         (SELECT c.id FROM public.flight_plans c WHERE c.forked_from_id = f.id AND c.user_id = (SELECT auth.uid())
          ORDER BY c.created_at DESC LIMIT 1)
  FROM public.flight_plans f
  WHERE f.public_id = p_public_id AND f.visibility <> 'private' AND f.moderation_status = 'ok' AND f.status = 'exported'
    AND (SELECT auth.uid()) IS NOT NULL;
$$;
REVOKE EXECUTE ON FUNCTION public.get_plan_viewer_state(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_plan_viewer_state(TEXT) TO authenticated;

-- Lineage of the caller's own copies: "Based on ..." or, when the original is gone / private / hidden, an
-- orphan with nothing about the original (never who wrote it).
CREATE OR REPLACE FUNCTION public.get_plan_lineage(p_plan_ids UUID[])
RETURNS TABLE (
  plan_id UUID,
  orphan BOOLEAN,
  original_public_id TEXT,
  original_origin TEXT,
  original_destination TEXT,
  original_flight_number TEXT,
  original_author TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT f.id,
         (o.id IS NULL OR o.visibility = 'private' OR o.moderation_status = 'hidden') AS orphan,
         CASE WHEN o.visibility <> 'private' AND o.moderation_status = 'ok' THEN o.public_id END,
         CASE WHEN o.visibility <> 'private' AND o.moderation_status = 'ok' THEN o.origin_airport END,
         CASE WHEN o.visibility <> 'private' AND o.moderation_status = 'ok' THEN o.destination_airport END,
         CASE WHEN o.visibility <> 'private' AND o.moderation_status = 'ok' THEN o.flight_number END,
         CASE WHEN o.visibility <> 'private' AND o.moderation_status = 'ok' THEN p.discord_username END
  FROM public.flight_plans f
  LEFT JOIN public.flight_plans o ON o.id = f.forked_from_id
  LEFT JOIN public.profiles p ON p.id = o.user_id
  WHERE f.id = ANY (p_plan_ids) AND f.user_id = (SELECT auth.uid()) AND f.is_fork;
$$;
REVOKE EXECUTE ON FUNCTION public.get_plan_lineage(UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_plan_lineage(UUID[]) TO authenticated;

-- Rollback:
--   DROP FUNCTION public.get_plan_lineage(UUID[]), public.get_plan_viewer_state(TEXT), public.get_plan_stats(TEXT), public.record_plan_download(TEXT, UUID),
--     public.import_flight_plan(TEXT), public.set_plan_like(TEXT, BOOLEAN), public.actionable_plan(TEXT);
