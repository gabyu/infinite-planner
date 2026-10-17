-- Public flight plan library, step 3 (Explore): the listing behind /explore, the route and airport hubs
-- and the "more like this" blocks of a plan page.
--
-- Additive and read-only. service_role only: the pages call it on the server, nothing about the
-- library's listing is exposed to the public key. Returns the card fields of public plans (never user_id),
-- plus a thinned-out route (lat/lng only, about 60 points) for the card's thumbnail.
--
-- Keyset pagination: rows are ordered by (sort_value DESC, id DESC) and the next page asks for rows
-- strictly after the last one. `p_as_of` freezes "now" for the popularity score, so the order doesn't
-- drift between two pages of the same visit (the cursor carries it).

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
  p_limit INTEGER DEFAULT 24
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
  sort_value DOUBLE PRECISION
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
        -- Popularity: (downloads + 10 x likes + 5 x imports) / (days since published + 1).
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
  )
  SELECT b.id, b.public_id, b.origin_airport, b.destination_airport, b.flight_number, b.source,
         b.distance_nm, b.flight_time_minutes, b.like_count, b.import_count, b.download_count, b.published_at,
         p.discord_username, p.avatar_url, p.public_id,
         (SELECT jsonb_agg(jsonb_build_object('lat', (w ->> 'lat')::DOUBLE PRECISION, 'lng', (w ->> 'lng')::DOUBLE PRECISION) ORDER BY i)
          FROM jsonb_array_elements(b.waypoints) WITH ORDINALITY AS t(w, i)
          WHERE (i - 1) % GREATEST(1, CEIL(jsonb_array_length(b.waypoints) / 60.0)::INTEGER) = 0
             OR i = jsonb_array_length(b.waypoints)),
         b.sv
  FROM base b
  JOIN public.profiles p ON p.id = b.user_id
  WHERE (p_author_public_id IS NULL OR p.public_id = p_author_public_id)
    AND (p_after_id IS NULL OR (b.sv, b.id) < (p_after_value, p_after_id))
  ORDER BY b.sv DESC, b.id DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 100);
$$;

REVOKE EXECUTE ON FUNCTION public.list_public_plans(TEXT, TEXT[], TEXT[], TEXT[], TEXT, TEXT, TEXT, TEXT, TIMESTAMP WITH TIME ZONE, DOUBLE PRECISION, UUID, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_public_plans(TEXT, TEXT[], TEXT[], TEXT[], TEXT, TEXT, TEXT, TEXT, TIMESTAMP WITH TIME ZONE, DOUBLE PRECISION, UUID, INTEGER) TO service_role;

-- Rollback:
--   DROP FUNCTION public.list_public_plans(TEXT, TEXT[], TEXT[], TEXT[], TEXT, TEXT, TEXT, TEXT, TIMESTAMP WITH TIME ZONE, DOUBLE PRECISION, UUID, INTEGER);
