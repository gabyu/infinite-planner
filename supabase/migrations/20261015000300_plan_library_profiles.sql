-- Public flight plan library, step 4 (profiles, featured, consent, favorites).
--
-- Additive except one thing: list_public_plans (step 3, never released) gains a `featured` column and a
-- `p_featured_only` filter, which changes its signature, so the old one is dropped and re-created.
--
-- get_pilot_profile is the only way to read another user's profile: it returns a fixed set of public
-- facts and aggregates, never the profiles row (role, must_change_password, e-mail...) and never the list
-- of someone's private plans. The profiles table itself stays closed to other users.

-- 1. Featured plans: the owner picks up to 6 of their public plans to show first on their profile -----------
CREATE OR REPLACE FUNCTION public.set_plan_featured(p_plan_id UUID, p_featured BOOLEAN)
RETURNS BOOLEAN
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  uid UUID := (SELECT auth.uid());
  plan public.flight_plans;
  featured_now INTEGER;
  max_featured CONSTANT INTEGER := 6;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_signed_in' USING ERRCODE = '28000'; END IF;
  SELECT * INTO plan FROM public.flight_plans f WHERE f.id = p_plan_id AND f.user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'plan_not_found' USING ERRCODE = 'P0002'; END IF;

  IF p_featured THEN
    IF plan.visibility <> 'public' THEN
      RAISE EXCEPTION 'not_public: only a public flight plan can be featured' USING ERRCODE = 'check_violation';
    END IF;
    IF NOT plan.featured THEN
      SELECT count(*) INTO featured_now FROM public.flight_plans f WHERE f.user_id = uid AND f.featured;
      IF featured_now >= max_featured THEN
        RAISE EXCEPTION 'too_many_featured: you can feature up to 6 flight plans' USING ERRCODE = 'check_violation';
      END IF;
    END IF;
  END IF;

  UPDATE public.flight_plans f SET featured = p_featured WHERE f.id = plan.id;
  RETURN p_featured;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.set_plan_featured(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_plan_featured(UUID, BOOLEAN) TO authenticated;

-- 2. Consent to show the name and avatar publicly (asked the first time someone chooses Public) -------------
CREATE OR REPLACE FUNCTION public.record_library_consent()
RETURNS TIMESTAMP WITH TIME ZONE
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
  UPDATE public.profiles p
  SET library_consent_at = COALESCE(p.library_consent_at, NOW())
  WHERE p.id = (SELECT auth.uid())
  RETURNING p.library_consent_at;
$$;
REVOKE EXECUTE ON FUNCTION public.record_library_consent() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_library_consent() TO authenticated;

-- 3. A pilot's profile ---------------------------------------------------------------------------------------
-- Signed-in users only. Aggregates cover ALL the pilot's exported plans, private ones included, but only the
-- aggregate is returned (a count, a sum, the single favorite airport, three flight numbers): never which
-- private plans they are made of.
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

-- 4. The listing, with `featured` ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.list_public_plans(TEXT, TEXT[], TEXT[], TEXT[], TEXT, TEXT, TEXT, TEXT, TIMESTAMP WITH TIME ZONE, DOUBLE PRECISION, UUID, INTEGER);

CREATE OR REPLACE FUNCTION public.list_public_plans(
  p_sort TEXT DEFAULT 'popular',
  p_origins TEXT[] DEFAULT NULL,
  p_destinations TEXT[] DEFAULT NULL,
  p_airports TEXT[] DEFAULT NULL,
  p_flight TEXT DEFAULT NULL,
  p_source TEXT DEFAULT NULL,
  p_author_public_id TEXT DEFAULT NULL,
  p_exclude_public_id TEXT DEFAULT NULL,
  p_as_of TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_after_value DOUBLE PRECISION DEFAULT NULL,
  p_after_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 24,
  p_featured_only BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  id UUID,
  public_id TEXT,
  origin_airport TEXT,
  destination_airport TEXT,
  flight_number TEXT,
  source TEXT,
  distance_nm INTEGER,
  flight_time_minutes INTEGER,
  like_count INTEGER,
  import_count INTEGER,
  download_count INTEGER,
  published_at TIMESTAMP WITH TIME ZONE,
  author_name TEXT,
  author_avatar_url TEXT,
  author_public_id TEXT,
  route JSONB,
  sort_value DOUBLE PRECISION,
  featured BOOLEAN
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  WITH params AS (SELECT COALESCE(p_as_of, NOW()) AS as_of),
  base AS (
    SELECT f.*,
      CASE p_sort
        WHEN 'latest' THEN EXTRACT(EPOCH FROM f.published_at)::DOUBLE PRECISION
        WHEN 'imported' THEN f.import_count::DOUBLE PRECISION
        WHEN 'downloaded' THEN f.download_count::DOUBLE PRECISION
        WHEN 'liked' THEN f.like_count::DOUBLE PRECISION
        ELSE (f.download_count + 10 * f.like_count + 5 * f.import_count)::DOUBLE PRECISION
             / (GREATEST(EXTRACT(EPOCH FROM ((SELECT as_of FROM params) - f.published_at)) / 86400.0, 0) + 1)
      END AS sv
    FROM public.flight_plans f
    WHERE f.visibility = 'public' AND f.moderation_status = 'ok' AND f.status = 'exported'
      AND (p_origins IS NULL OR f.origin_airport = ANY (p_origins))
      AND (p_destinations IS NULL OR f.destination_airport = ANY (p_destinations))
      AND (p_airports IS NULL OR f.origin_airport = ANY (p_airports) OR f.destination_airport = ANY (p_airports))
      AND (p_flight IS NULL OR f.flight_number = p_flight)
      AND (p_source IS NULL OR f.source = p_source)
      AND (p_exclude_public_id IS NULL OR f.public_id <> p_exclude_public_id)
      AND (NOT p_featured_only OR f.featured)
  )
  SELECT b.id, b.public_id, b.origin_airport, b.destination_airport, b.flight_number, b.source,
         b.distance_nm, b.flight_time_minutes, b.like_count, b.import_count, b.download_count, b.published_at,
         p.discord_username, p.avatar_url, p.public_id,
         (SELECT jsonb_agg(jsonb_build_object('lat', (w ->> 'lat')::DOUBLE PRECISION, 'lng', (w ->> 'lng')::DOUBLE PRECISION) ORDER BY i)
          FROM jsonb_array_elements(b.waypoints) WITH ORDINALITY AS t(w, i)
          WHERE (i - 1) % GREATEST(1, CEIL(jsonb_array_length(b.waypoints) / 60.0)::INTEGER) = 0
             OR i = jsonb_array_length(b.waypoints)),
         b.sv,
         b.featured
  FROM base b
  JOIN public.profiles p ON p.id = b.user_id
  WHERE (p_author_public_id IS NULL OR p.public_id = p_author_public_id)
    AND (p_after_id IS NULL OR (b.sv, b.id) < (p_after_value, p_after_id))
  ORDER BY b.sv DESC, b.id DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 100);
$$;
REVOKE EXECUTE ON FUNCTION public.list_public_plans(TEXT, TEXT[], TEXT[], TEXT[], TEXT, TEXT, TEXT, TEXT, TIMESTAMP WITH TIME ZONE, DOUBLE PRECISION, UUID, INTEGER, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_public_plans(TEXT, TEXT[], TEXT[], TEXT[], TEXT, TEXT, TEXT, TEXT, TIMESTAMP WITH TIME ZONE, DOUBLE PRECISION, UUID, INTEGER, BOOLEAN) TO service_role;

-- 5. The dashboard's Favorites tab: plans the caller liked, as long as they are still visible -----------------
CREATE OR REPLACE FUNCTION public.get_my_favorites(p_limit INTEGER DEFAULT 24, p_offset INTEGER DEFAULT 0)
RETURNS TABLE (
  id UUID, public_id TEXT, origin_airport TEXT, destination_airport TEXT, flight_number TEXT, source TEXT,
  distance_nm INTEGER, flight_time_minutes INTEGER, like_count INTEGER, import_count INTEGER, download_count INTEGER,
  published_at TIMESTAMP WITH TIME ZONE, author_name TEXT, author_avatar_url TEXT, author_public_id TEXT,
  route JSONB, total BIGINT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT f.id, f.public_id, f.origin_airport, f.destination_airport, f.flight_number, f.source,
         f.distance_nm, f.flight_time_minutes, f.like_count, f.import_count, f.download_count, f.published_at,
         p.discord_username, p.avatar_url, p.public_id,
         (SELECT jsonb_agg(jsonb_build_object('lat', (w ->> 'lat')::DOUBLE PRECISION, 'lng', (w ->> 'lng')::DOUBLE PRECISION) ORDER BY i)
          FROM jsonb_array_elements(f.waypoints) WITH ORDINALITY AS t(w, i)
          WHERE (i - 1) % GREATEST(1, CEIL(jsonb_array_length(f.waypoints) / 60.0)::INTEGER) = 0
             OR i = jsonb_array_length(f.waypoints)),
         count(*) OVER ()
  FROM public.plan_likes l
  JOIN public.flight_plans f ON f.id = l.plan_id
  JOIN public.profiles p ON p.id = f.user_id
  WHERE l.user_id = (SELECT auth.uid())
    AND f.visibility <> 'private' AND f.moderation_status = 'ok' AND f.status = 'exported'
  ORDER BY l.created_at DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 100) OFFSET GREATEST(p_offset, 0);
$$;
REVOKE EXECUTE ON FUNCTION public.get_my_favorites(INTEGER, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_favorites(INTEGER, INTEGER) TO authenticated;

-- Rollback:
--   DROP FUNCTION public.get_my_favorites(INTEGER, INTEGER), public.get_pilot_profile(TEXT),
--     public.record_library_consent(), public.set_plan_featured(UUID, BOOLEAN),
--     public.list_public_plans(TEXT, TEXT[], TEXT[], TEXT[], TEXT, TEXT, TEXT, TEXT, TIMESTAMP WITH TIME ZONE, DOUBLE PRECISION, UUID, INTEGER, BOOLEAN);
--   then re-create list_public_plans from 20261015000200_plan_library_listing.sql.
