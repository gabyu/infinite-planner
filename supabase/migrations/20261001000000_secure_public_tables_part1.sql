-- Part 1/2 - safe to run BEFORE the matching app code is deployed.
--
-- Fixes Supabase advisory "rls_disabled_in_public" (staging) and the wide-open
-- policies on production. Reads stay public in this part so the currently
-- deployed app keeps working; part 2 closes them once the new code is live.

-- 1. `counters` is unused by the app (the total is COUNT(*) on flight_statistics).
DROP FUNCTION IF EXISTS public.increment_counter(TEXT);
DROP TABLE IF EXISTS public.counters;

-- 2. flight_statistics: RLS on, minimal privileges, validated public inserts.
ALTER TABLE public.flight_statistics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access on flight_statistics" ON public.flight_statistics;
DROP POLICY IF EXISTS "Allow public insert access on flight_statistics" ON public.flight_statistics;
DROP POLICY IF EXISTS "Public read (temporary)" ON public.flight_statistics;
DROP POLICY IF EXISTS "Public insert (validated)" ON public.flight_statistics;

REVOKE ALL ON public.flight_statistics FROM anon, authenticated;
GRANT SELECT, INSERT ON public.flight_statistics TO anon, authenticated;

-- Dropped in part 2.
CREATE POLICY "Public read (temporary)" ON public.flight_statistics
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Public insert (validated)" ON public.flight_statistics
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    char_length(filename) BETWEEN 1 AND 200
    AND (flight_number IS NULL OR char_length(flight_number) <= 12)
    AND (origin_airport IS NULL OR char_length(origin_airport) <= 8)
    AND (destination_airport IS NULL OR char_length(destination_airport) <= 8)
    AND (flight_date IS NULL OR char_length(flight_date) <= 16)
    AND (source IS NULL OR source IN ('FlightAware', 'FlightRadar24', 'DrawingBoard'))
  );

-- 3. Stats functions: SECURITY DEFINER so they keep working once direct reads
--    are closed; fixed search_path; only anon/authenticated may execute.
CREATE OR REPLACE FUNCTION public.get_popular_airports(result_limit INT DEFAULT 10)
RETURNS TABLE(airport_code TEXT, count BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT a.airport_code, COUNT(*) AS count
  FROM (
    SELECT origin_airport AS airport_code FROM public.flight_statistics WHERE origin_airport IS NOT NULL
    UNION ALL
    SELECT destination_airport AS airport_code FROM public.flight_statistics WHERE destination_airport IS NOT NULL
  ) AS a
  GROUP BY a.airport_code
  ORDER BY count DESC
  LIMIT LEAST(result_limit, 100);
$$;

CREATE OR REPLACE FUNCTION public.get_popular_flights(result_limit INT DEFAULT 10)
RETURNS TABLE(flight_number TEXT, count BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT f.flight_number, COUNT(*) AS count
  FROM public.flight_statistics f
  WHERE f.flight_number IS NOT NULL
  GROUP BY f.flight_number
  ORDER BY count DESC
  LIMIT LEAST(result_limit, 100);
$$;

CREATE OR REPLACE FUNCTION public.get_unique_airport_count()
RETURNS BIGINT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT COUNT(DISTINCT a.airport_code) FROM (
    SELECT origin_airport AS airport_code FROM public.flight_statistics WHERE origin_airport IS NOT NULL
    UNION
    SELECT destination_airport AS airport_code FROM public.flight_statistics WHERE destination_airport IS NOT NULL
  ) AS a;
$$;

CREATE OR REPLACE FUNCTION public.get_flight_count()
RETURNS BIGINT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT COUNT(*) FROM public.flight_statistics;
$$;

REVOKE EXECUTE ON FUNCTION public.get_popular_airports(INT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_popular_flights(INT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_unique_airport_count() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_flight_count() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_popular_airports(INT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_popular_flights(INT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_unique_airport_count() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_flight_count() TO anon, authenticated;
