-- Admin Activity page: the latest exported flight plans with who made them.
--
-- Additive: a single new function, no table or policy is touched. Safe to run BEFORE the
-- matching app code is deployed (nothing calls it until that code is live).
--
-- Only plans exported by signed-in users exist in flight_plans; anonymous exports leave no
-- route behind (flight_statistics is written at import time and carries no user). A plan whose
-- owner has no Discord name comes back with a NULL discord_username (shown as anonymous).

CREATE OR REPLACE FUNCTION public.admin_recent_activity(p_limit INTEGER DEFAULT 30)
RETURNS TABLE (
  origin_airport TEXT,
  destination_airport TEXT,
  origin_airport_name TEXT,
  destination_airport_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  discord_username TEXT,
  avatar_url TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT f.origin_airport, f.destination_airport, f.origin_airport_name, f.destination_airport_name,
         f.created_at, p.discord_username, p.avatar_url
  FROM public.flight_plans f
  JOIN public.profiles p ON p.id = f.user_id
  WHERE public.is_admin() AND f.status = 'exported'
  ORDER BY f.created_at DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 100);
$$;

REVOKE EXECUTE ON FUNCTION public.admin_recent_activity(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_recent_activity(INTEGER) TO authenticated;

-- Rollback (nothing depends on it):
--   DROP FUNCTION public.admin_recent_activity(INTEGER);
