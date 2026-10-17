-- Public flight plan library, step 6 (launch switch): what the admin Settings card reads and does.
--
-- Additive. The flag itself (app_settings.library_launched, default FALSE) was created in the first
-- migration. There is deliberately no function that un-launches: the emergency rollback is SQL, see the
-- release notes:   UPDATE public.app_settings SET library_launched = FALSE WHERE id;

CREATE OR REPLACE FUNCTION public.admin_get_library_settings()
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'launched', s.library_launched,
    'launched_at', s.library_launched_at,
    'target', s.library_target,
    'public_plans', (SELECT count(*) FROM public.flight_plans f
                     WHERE f.visibility = 'public' AND f.moderation_status = 'ok' AND f.status = 'exported')
  )
  FROM public.app_settings s
  WHERE s.id AND (SELECT public.is_admin());
$$;
REVOKE EXECUTE ON FUNCTION public.admin_get_library_settings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_library_settings() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_library_target(p_target INTEGER)
RETURNS VOID
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT (SELECT public.is_admin()) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = 'insufficient_privilege'; END IF;
  IF p_target IS NULL OR p_target < 1 OR p_target > 100000 THEN RAISE EXCEPTION 'invalid_target' USING ERRCODE = '22023'; END IF;
  UPDATE public.app_settings SET library_target = p_target WHERE id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_set_library_target(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_library_target(INTEGER) TO authenticated;

-- Opens the library to everyone. Idempotent: launching twice keeps the first launch time.
CREATE OR REPLACE FUNCTION public.admin_launch_library()
RETURNS TIMESTAMP WITH TIME ZONE
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  result TIMESTAMP WITH TIME ZONE;
BEGIN
  IF NOT (SELECT public.is_admin()) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = 'insufficient_privilege'; END IF;
  UPDATE public.app_settings
  SET library_launched = TRUE, library_launched_at = COALESCE(library_launched_at, NOW())
  WHERE id
  RETURNING library_launched_at INTO result;
  RETURN result;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_launch_library() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_launch_library() TO authenticated;

-- Rollback: DROP FUNCTION public.admin_launch_library(), public.admin_set_library_target(INTEGER), public.admin_get_library_settings();
