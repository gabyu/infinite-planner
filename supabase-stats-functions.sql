-- Fixes "Infinite Planner Statistics" showing stale/incomplete data.
--
-- Root cause: the app used to fetch flight_statistics rows unpaginated and
-- aggregate them in the browser. Supabase/PostgREST caps unpaginated selects
-- at 1000 rows by default, and with no ORDER BY the same ~1000 oldest rows
-- were returned every time - so "Popular Airports", "Popular Flights", and
-- "Unique Airports" were frozen on flights imported between June and July
-- 2025 and never saw anything imported after that.
--
-- These functions aggregate directly in Postgres (GROUP BY + LIMIT), so they
-- stay correct and fast no matter how large flight_statistics grows.
--
-- Run this once in the Supabase SQL editor (Project -> SQL Editor -> New query).

CREATE OR REPLACE FUNCTION get_popular_airports(result_limit INT DEFAULT 10)
RETURNS TABLE(airport_code TEXT, count BIGINT) AS $$
  SELECT airport_code, COUNT(*) AS count
  FROM (
    SELECT origin_airport AS airport_code FROM flight_statistics WHERE origin_airport IS NOT NULL
    UNION ALL
    SELECT destination_airport AS airport_code FROM flight_statistics WHERE destination_airport IS NOT NULL
  ) AS airports
  GROUP BY airport_code
  ORDER BY count DESC
  LIMIT result_limit;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION get_popular_flights(result_limit INT DEFAULT 10)
RETURNS TABLE(flight_number TEXT, count BIGINT) AS $$
  SELECT flight_number, COUNT(*) AS count
  FROM flight_statistics
  WHERE flight_number IS NOT NULL
  GROUP BY flight_number
  ORDER BY count DESC
  LIMIT result_limit;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION get_unique_airport_count()
RETURNS BIGINT AS $$
  SELECT COUNT(DISTINCT airport_code) FROM (
    SELECT origin_airport AS airport_code FROM flight_statistics WHERE origin_airport IS NOT NULL
    UNION
    SELECT destination_airport AS airport_code FROM flight_statistics WHERE destination_airport IS NOT NULL
  ) AS airports;
$$ LANGUAGE sql STABLE;

-- Allow the app's anon (public) role to call these read-only functions.
GRANT EXECUTE ON FUNCTION get_popular_airports(INT) TO anon;
GRANT EXECUTE ON FUNCTION get_popular_flights(INT) TO anon;
GRANT EXECUTE ON FUNCTION get_unique_airport_count() TO anon;
