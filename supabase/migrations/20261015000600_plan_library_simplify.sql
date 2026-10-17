-- Public flight plan library: simplification. A flight plan is either PRIVATE or PUBLIC (no "unlisted"), and
-- the old share links are gone for good.
--
-- DESTRUCTIVE for sharing, on purpose (decision of 2026-10-14): every plan that was "shared" (a share_token, or
-- visibility 'unlisted') goes back to private and its link stops working. Nothing else is touched: plans,
-- drafts, likes and downloads stay. Run it together with the code that no longer has /shared/{token}.
--
-- Also: list_public_plans returns the plan's creation date and the altitude of each thinned-out route point
-- (cards show the date and colour the route by altitude). That changes its signature, so it is re-created.

-- 1. Unlisted plans and every legacy share link are withdrawn -------------------------------------------------
UPDATE public.flight_plans
SET visibility = 'private', published_at = NULL, featured = FALSE
WHERE visibility = 'unlisted';

UPDATE public.flight_plans SET share_token = NULL WHERE share_token IS NOT NULL;

ALTER TABLE public.flight_plans DROP CONSTRAINT IF EXISTS flight_plans_visibility_check;
ALTER TABLE public.flight_plans
  ADD CONSTRAINT flight_plans_visibility_check CHECK (visibility IN ('private', 'public'));

-- 2. The share-link functions are removed ----------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.share_flight_plan(UUID);
DROP FUNCTION IF EXISTS public.unshare_flight_plan(UUID);
DROP FUNCTION IF EXISTS public.record_shared_download(UUID);
DROP FUNCTION IF EXISTS public.public_id_for_share_token(UUID);
DROP FUNCTION IF EXISTS public.record_public_download(TEXT);

-- 3. set_plan_visibility: private or public only ---------------------------------------------------------------
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

-- 4. The listing: creation date, and altitude on the route points ---------------------------------------------------
DROP FUNCTION IF EXISTS public.list_public_plans(TEXT, TEXT[], TEXT[], TEXT[], TEXT, TEXT, TEXT, TEXT, TIMESTAMP WITH TIME ZONE, DOUBLE PRECISION, UUID, INTEGER, BOOLEAN);

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
  featured BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE
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
         (SELECT jsonb_agg(jsonb_build_object(
                   'lat', (w ->> 'lat')::DOUBLE PRECISION,
                   'lng', (w ->> 'lng')::DOUBLE PRECISION,
                   'alt', COALESCE((w ->> 'altitude')::DOUBLE PRECISION, 0)) ORDER BY i)
          FROM jsonb_array_elements(b.waypoints) WITH ORDINALITY AS t(w, i)
          WHERE (i - 1) % GREATEST(1, CEIL(jsonb_array_length(b.waypoints) / 60.0)::INTEGER) = 0
             OR i = jsonb_array_length(b.waypoints)),
         b.sv,
         b.featured,
         b.created_at
  FROM base b
  JOIN public.profiles p ON p.id = b.user_id
  WHERE (p_author_public_id IS NULL OR p.public_id = p_author_public_id)
    AND (p_after_id IS NULL OR (b.sv, b.id) < (p_after_value, p_after_id))
  ORDER BY b.sv DESC, b.id DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 100);
$$;
REVOKE EXECUTE ON FUNCTION public.list_public_plans(TEXT, TEXT[], TEXT[], TEXT[], TEXT, TEXT, TEXT, TEXT, TIMESTAMP WITH TIME ZONE, DOUBLE PRECISION, UUID, INTEGER, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_public_plans(TEXT, TEXT[], TEXT[], TEXT[], TEXT, TEXT, TEXT, TEXT, TIMESTAMP WITH TIME ZONE, DOUBLE PRECISION, UUID, INTEGER, BOOLEAN) TO service_role;

-- Rollback: the withdrawn share links can't be brought back (their tokens are gone). To go back to three
-- visibilities: re-add 'unlisted' to flight_plans_visibility_check and re-create set_plan_visibility from
-- 20261015000000_plan_library_foundation.sql and list_public_plans from 20261015000300_plan_library_profiles.sql.
