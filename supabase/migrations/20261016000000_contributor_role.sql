-- A new role between a Discord member ('user') and an admin: 'contributor'.
--
-- Contributors are Discord accounts that an admin has raised to publish flight plans during the soft launch of the
-- library (they can use the library while it isn't launched). After the launch they keep the role as a badge of honour.
-- They get no admin space: they see the same site as every other Discord member. Only admins grant or withdraw the
-- role, through the functions below (a user cannot write profiles.role: it has no column grant).
--
-- Additive, safe before the matching code. is_admin() is untouched: a contributor is NOT an admin.

-- 1. The role ---------------------------------------------------------------------------------------------------
DO $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%role%'
  LOOP
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check CHECK (role IN ('user', 'contributor', 'admin')),
  ADD COLUMN IF NOT EXISTS contributor_since TIMESTAMP WITH TIME ZONE;

-- 2. What the app asks about the signed-in user -------------------------------------------------------------
-- 'admin' (an active one, as in is_admin()), 'contributor' or 'user'. NULL when nobody is signed in.
CREATE OR REPLACE FUNCTION public.viewer_role()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT CASE
           WHEN p.role = 'admin' AND NOT p.must_change_password THEN 'admin'
           WHEN p.role = 'contributor' THEN 'contributor'
           ELSE 'user'
         END
  FROM public.profiles p
  WHERE p.id = (SELECT auth.uid());
$$;
REVOKE EXECUTE ON FUNCTION public.viewer_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.viewer_role() TO authenticated;

-- Who can use the library before its launch: admins and contributors.
CREATE OR REPLACE FUNCTION public.has_library_preview()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT COALESCE((SELECT public.viewer_role()) IN ('admin', 'contributor'), FALSE);
$$;
REVOKE EXECUTE ON FUNCTION public.has_library_preview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_library_preview() TO authenticated;

-- 3. Admin: the contributors, and who could become one -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_contributors()
RETURNS TABLE (
  id UUID,
  discord_username TEXT,
  avatar_url TEXT,
  contributor_since TIMESTAMP WITH TIME ZONE,
  published_count BIGINT,
  downloads_received BIGINT,
  likes_received BIGINT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT p.id, p.discord_username, p.avatar_url, p.contributor_since,
         COUNT(f.id) FILTER (WHERE f.visibility = 'public' AND f.moderation_status = 'ok' AND f.status = 'exported'),
         COALESCE(SUM(f.download_count) FILTER (WHERE f.visibility = 'public'), 0)::BIGINT,
         COALESCE(SUM(f.like_count) FILTER (WHERE f.visibility = 'public'), 0)::BIGINT
  FROM public.profiles p
  LEFT JOIN public.flight_plans f ON f.user_id = p.id
  WHERE (SELECT public.is_admin()) AND p.role = 'contributor'
  GROUP BY p.id
  ORDER BY p.contributor_since DESC NULLS LAST, p.created_at DESC;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_list_contributors() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_contributors() TO authenticated;

-- Discord members (not yet contributors, not admins) matching a name: the pool to pick from.
CREATE OR REPLACE FUNCTION public.admin_find_members(p_query TEXT)
RETURNS TABLE (id UUID, discord_username TEXT, avatar_url TEXT, created_at TIMESTAMP WITH TIME ZONE, exported_count BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT p.id, p.discord_username, p.avatar_url, p.created_at,
         (SELECT count(*) FROM public.flight_plans f WHERE f.user_id = p.id AND f.status = 'exported')
  FROM public.profiles p
  WHERE (SELECT public.is_admin()) AND p.role = 'user' AND p.discord_username IS NOT NULL
    AND NULLIF(BTRIM(p_query), '') IS NOT NULL
    -- % and _ typed by the admin are literal characters, not wildcards
    AND p.discord_username ILIKE '%' || REPLACE(REPLACE(REPLACE(BTRIM(p_query), '\', '\\'), '%', '\%'), '_', '\_') || '%'
  ORDER BY p.discord_username
  LIMIT 10;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_find_members(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_find_members(TEXT) TO authenticated;

-- 4. Admin: raise / demote ---------------------------------------------------------------------------------------
-- Only between 'user' and 'contributor'. An admin is never touched here (and cannot be made one from here).
CREATE OR REPLACE FUNCTION public.admin_set_contributor(p_user_id UUID, p_contributor BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT (SELECT public.is_admin()) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = 'insufficient_privilege'; END IF;
  IF p_contributor THEN
    -- A Discord account only: the public pages name the author by their Discord name.
    UPDATE public.profiles p
    SET role = 'contributor', contributor_since = NOW()
    WHERE p.id = p_user_id AND p.role = 'user' AND p.discord_username IS NOT NULL;
  ELSE
    UPDATE public.profiles p
    SET role = 'user', contributor_since = NULL
    WHERE p.id = p_user_id AND p.role = 'contributor';
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'user_not_eligible' USING ERRCODE = 'P0002'; END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_set_contributor(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_contributor(UUID, BOOLEAN) TO authenticated;

-- 5. The badge on profiles and plan pages -----------------------------------------------------------------------
-- Only the badge is exposed, never the role: 'badges' is the list of honours a pilot holds (contributor today,
-- others later).
CREATE OR REPLACE FUNCTION public.get_pilot_profile(p_profile_public_id TEXT)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'public_id', p.public_id,
    'name', COALESCE(p.discord_username, 'Infinite Planner admin'),
    'avatar_url', p.avatar_url,
    'member_since', p.created_at,
    'is_self', p.id = (SELECT auth.uid()),
    'badges', CASE WHEN p.role = 'contributor' THEN '["contributor"]'::JSONB ELSE '[]'::JSONB END,
    'plans_created', (SELECT count(*) FROM public.flight_plans f WHERE f.user_id = p.id AND f.status = 'exported'),
    'plans_published', (SELECT count(*) FROM public.flight_plans f
                        WHERE f.user_id = p.id AND f.status = 'exported' AND f.visibility = 'public' AND f.moderation_status = 'ok'),
    'total_distance_nm', (SELECT COALESCE(sum(f.distance_nm), 0) FROM public.flight_plans f WHERE f.user_id = p.id AND f.status = 'exported'),
    'downloads_received', (SELECT COALESCE(sum(f.download_count), 0) FROM public.flight_plans f WHERE f.user_id = p.id AND f.status = 'exported'),
    'likes_received', (SELECT COALESCE(sum(f.like_count), 0) FROM public.flight_plans f WHERE f.user_id = p.id AND f.status = 'exported'),
    'favorite_airport', (
      SELECT a.icao FROM (
        SELECT unnest(ARRAY[f.origin_airport, f.destination_airport]) AS icao
        FROM public.flight_plans f WHERE f.user_id = p.id AND f.status = 'exported'
      ) a GROUP BY a.icao ORDER BY count(*) DESC, a.icao LIMIT 1),
    'top_flights', COALESCE((
      SELECT jsonb_agg(t.flight_number ORDER BY t.n DESC, t.flight_number) FROM (
        SELECT f.flight_number, count(*) AS n FROM public.flight_plans f
        WHERE f.user_id = p.id AND f.status = 'exported' AND f.flight_number IS NOT NULL
        GROUP BY f.flight_number ORDER BY count(*) DESC, f.flight_number LIMIT 3
      ) t), '[]'::JSONB)
  )
  FROM public.profiles p
  WHERE p.public_id = p_profile_public_id AND (SELECT auth.uid()) IS NOT NULL;
$$;
REVOKE EXECUTE ON FUNCTION public.get_pilot_profile(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_pilot_profile(TEXT) TO authenticated;

DROP FUNCTION IF EXISTS public.get_public_plan(TEXT);
CREATE OR REPLACE FUNCTION public.get_public_plan(p_public_id TEXT)
RETURNS TABLE (
  public_id TEXT,
  visibility TEXT,
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE,
  source TEXT,
  flight_number TEXT,
  origin_airport TEXT,
  destination_airport TEXT,
  origin_airport_name TEXT,
  destination_airport_name TEXT,
  flight_time_minutes INTEGER,
  includes_branding BOOLEAN,
  waypoints JSONB,
  distance_nm INTEGER,
  max_altitude_ft INTEGER,
  like_count INTEGER,
  import_count INTEGER,
  download_count INTEGER,
  author_name TEXT,
  author_avatar_url TEXT,
  author_public_id TEXT,
  author_is_contributor BOOLEAN
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT f.public_id, f.visibility, f.published_at, f.created_at, f.source, f.flight_number,
         f.origin_airport, f.destination_airport, f.origin_airport_name, f.destination_airport_name,
         f.flight_time_minutes, f.includes_branding, f.waypoints, f.distance_nm, f.max_altitude_ft,
         f.like_count, f.import_count, f.download_count,
         p.discord_username, p.avatar_url, p.public_id, (p.role = 'contributor')
  FROM public.flight_plans f
  JOIN public.profiles p ON p.id = f.user_id
  WHERE f.public_id = p_public_id
    AND f.visibility <> 'private'
    AND f.moderation_status = 'ok'
    AND f.status = 'exported';
$$;
REVOKE EXECUTE ON FUNCTION public.get_public_plan(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_plan(TEXT) TO service_role;

-- Rollback: demote everyone first (UPDATE public.profiles SET role = 'user' WHERE role = 'contributor';), then
--   ALTER TABLE public.profiles DROP CONSTRAINT profiles_role_check;
--   ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('user', 'admin'));
--   ALTER TABLE public.profiles DROP COLUMN contributor_since;
--   DROP FUNCTION public.admin_set_contributor(UUID, BOOLEAN), public.admin_find_members(TEXT),
--     public.admin_list_contributors(), public.has_library_preview(), public.viewer_role();
--   and re-create get_pilot_profile / get_public_plan from 20261015000300 / 20261015000000 (+ ...000600 for the listing).
