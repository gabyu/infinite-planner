-- Public flight plan library, step 5 (moderation): reporting a plan, and the admin functions behind the
-- Routes section of the admin dashboard (library overview, hide / unhide, report queue, publishing block).
--
-- Additive. The admin functions are SECURITY DEFINER and check is_admin() themselves, so a signed-in
-- non-admin gets nothing back; the reports table stays closed to everyone else.

-- 1. Reporting: a signed-in user, one open report per plan ----------------------------------------------------
CREATE OR REPLACE FUNCTION public.report_flight_plan(p_public_id TEXT, p_reason TEXT, p_details TEXT DEFAULT NULL)
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
  INSERT INTO public.plan_reports (plan_id, reporter_id, reason, details)
  VALUES (plan.id, uid, p_reason, NULLIF(LEFT(btrim(COALESCE(p_details, '')), 500), ''))
  ON CONFLICT (reporter_id, plan_id) WHERE resolved_at IS NULL DO NOTHING;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.report_flight_plan(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_flight_plan(TEXT, TEXT, TEXT) TO authenticated;

-- 2. Admin: the plans in the library ------------------------------------------------------------------------------
-- Public plans (hidden ones included, with their status), newest first. Filters are optional.
CREATE OR REPLACE FUNCTION public.admin_list_library_plans(
  p_route TEXT DEFAULT NULL,
  p_flight TEXT DEFAULT NULL,
  p_source TEXT DEFAULT NULL,
  p_author TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID, public_id TEXT, origin_airport TEXT, destination_airport TEXT, flight_number TEXT, source TEXT,
  published_at TIMESTAMP WITH TIME ZONE, like_count INTEGER, import_count INTEGER, download_count INTEGER,
  moderation_status TEXT, author_id UUID, author_name TEXT, author_blocked BOOLEAN,
  open_reports BIGINT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT f.id, f.public_id, f.origin_airport, f.destination_airport, f.flight_number, f.source,
         f.published_at, f.like_count, f.import_count, f.download_count, f.moderation_status,
         p.id, COALESCE(p.discord_username, 'Infinite Planner admin'), p.publishing_blocked,
         (SELECT count(*) FROM public.plan_reports r WHERE r.plan_id = f.id AND r.resolved_at IS NULL)
  FROM public.flight_plans f
  JOIN public.profiles p ON p.id = f.user_id
  WHERE (SELECT public.is_admin())
    AND f.visibility = 'public' AND f.status = 'exported'
    AND (p_route IS NULL OR f.origin_airport || '-' || f.destination_airport ILIKE '%' || p_route || '%')
    AND (p_flight IS NULL OR f.flight_number ILIKE p_flight || '%')
    AND (p_source IS NULL OR f.source = p_source)
    AND (p_author IS NULL OR p.discord_username ILIKE '%' || p_author || '%')
  ORDER BY f.published_at DESC NULLS LAST
  LIMIT 500;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_list_library_plans(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_library_plans(TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- Hide / unhide a plan. Returns its public id so the caller can drop the cached page.
CREATE OR REPLACE FUNCTION public.admin_set_plan_moderation(p_plan_id UUID, p_status TEXT)
RETURNS TEXT
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  result TEXT;
BEGIN
  IF NOT (SELECT public.is_admin()) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = 'insufficient_privilege'; END IF;
  IF p_status NOT IN ('ok', 'hidden') THEN RAISE EXCEPTION 'invalid_status' USING ERRCODE = '22023'; END IF;
  -- A hidden plan is no longer featured.
  UPDATE public.flight_plans f
  SET moderation_status = p_status, featured = CASE WHEN p_status = 'hidden' THEN FALSE ELSE f.featured END
  WHERE f.id = p_plan_id
  RETURNING f.public_id INTO result;
  IF NOT FOUND THEN RAISE EXCEPTION 'plan_not_found' USING ERRCODE = 'P0002'; END IF;
  RETURN result;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_set_plan_moderation(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_plan_moderation(UUID, TEXT) TO authenticated;

-- 3. Admin: the report queue ----------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_reports()
RETURNS TABLE (
  id UUID, created_at TIMESTAMP WITH TIME ZONE, reason TEXT, details TEXT, reporter_name TEXT,
  plan_id UUID, public_id TEXT, origin_airport TEXT, destination_airport TEXT, flight_number TEXT,
  moderation_status TEXT, author_id UUID, author_name TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT r.id, r.created_at, r.reason, r.details, COALESCE(rp.discord_username, 'Infinite Planner admin'),
         f.id, f.public_id, f.origin_airport, f.destination_airport, f.flight_number, f.moderation_status,
         ap.id, COALESCE(ap.discord_username, 'Infinite Planner admin')
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

-- Resolves a report; with p_hide the plan is hidden too (all the open reports about it are closed with it).
CREATE OR REPLACE FUNCTION public.admin_resolve_report(p_report_id UUID, p_hide BOOLEAN DEFAULT FALSE)
RETURNS TEXT
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  target UUID;
  result TEXT;
BEGIN
  IF NOT (SELECT public.is_admin()) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = 'insufficient_privilege'; END IF;
  SELECT r.plan_id INTO target FROM public.plan_reports r WHERE r.id = p_report_id AND r.resolved_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'report_not_found' USING ERRCODE = 'P0002'; END IF;

  IF p_hide THEN
    UPDATE public.flight_plans f SET moderation_status = 'hidden', featured = FALSE WHERE f.id = target;
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

-- 4. Admin: stop a user from publishing ----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_set_publishing_blocked(p_user_id UUID, p_blocked BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT (SELECT public.is_admin()) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = 'insufficient_privilege'; END IF;
  UPDATE public.profiles p SET publishing_blocked = p_blocked WHERE p.id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'user_not_found' USING ERRCODE = 'P0002'; END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_set_publishing_blocked(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_publishing_blocked(UUID, BOOLEAN) TO authenticated;

-- 5. Admin: coverage of the library (what to seed next) -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_library_coverage()
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'public_plans', (SELECT count(*) FROM public.flight_plans f WHERE f.visibility = 'public' AND f.moderation_status = 'ok' AND f.status = 'exported'),
    'distinct_routes', (SELECT count(DISTINCT f.origin_airport || '-' || f.destination_airport) FROM public.flight_plans f
                        WHERE f.visibility = 'public' AND f.moderation_status = 'ok' AND f.status = 'exported'),
    'top_departures', COALESCE((SELECT jsonb_agg(jsonb_build_object('icao', t.icao, 'n', t.n)) FROM (
        SELECT f.origin_airport AS icao, count(*) AS n FROM public.flight_plans f
        WHERE f.visibility = 'public' AND f.moderation_status = 'ok' AND f.status = 'exported'
        GROUP BY f.origin_airport ORDER BY count(*) DESC, f.origin_airport LIMIT 8) t), '[]'::JSONB),
    'top_arrivals', COALESCE((SELECT jsonb_agg(jsonb_build_object('icao', t.icao, 'n', t.n)) FROM (
        SELECT f.destination_airport AS icao, count(*) AS n FROM public.flight_plans f
        WHERE f.visibility = 'public' AND f.moderation_status = 'ok' AND f.status = 'exported'
        GROUP BY f.destination_airport ORDER BY count(*) DESC, f.destination_airport LIMIT 8) t), '[]'::JSONB)
  )
  WHERE (SELECT public.is_admin());
$$;
REVOKE EXECUTE ON FUNCTION public.admin_library_coverage() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_library_coverage() TO authenticated;

-- Rollback:
--   DROP FUNCTION public.admin_library_coverage(), public.admin_set_publishing_blocked(UUID, BOOLEAN),
--     public.admin_resolve_report(UUID, BOOLEAN), public.admin_list_reports(), public.admin_set_plan_moderation(UUID, TEXT),
--     public.admin_list_library_plans(TEXT, TEXT, TEXT, TEXT), public.report_flight_plan(TEXT, TEXT, TEXT);
