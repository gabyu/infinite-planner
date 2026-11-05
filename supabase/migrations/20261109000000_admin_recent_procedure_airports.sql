-- Admin Procedures: the airports that most recently received something (a flight file added by an admin, or a procedure saved by a
-- member), newest first, for the "Recently updated" line at the top of the page. Admins only (is_admin()).
-- Safe before the app code: it adds one function. Needs 20261024000000_airport_procedures and 20261020000000_runway_guides.
-- Apply on STAGING first, then on PRODUCTION just before the release that uses it.
-- Rollback: DROP FUNCTION public.admin_recent_procedure_airports(INTEGER);
CREATE OR REPLACE FUNCTION public.admin_recent_procedure_airports(p_limit INTEGER DEFAULT 14)
RETURNS TABLE (airport TEXT, last_at TIMESTAMP WITH TIME ZONE)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  RETURN QUERY
    SELECT u.airport, max(u.at) AS last_at
    FROM (
      SELECT f.airport, f.created_at AS at FROM public.procedure_flights f
      UNION ALL
      SELECT g.airport, g.created_at AS at FROM public.runway_guides g
    ) u
    GROUP BY u.airport
    ORDER BY max(u.at) DESC
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 14), 1), 40);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_recent_procedure_airports(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_recent_procedure_airports(INTEGER) TO authenticated;
