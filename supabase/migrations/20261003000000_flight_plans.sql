-- Flight history + sharing: one row per flight plan a signed-in user has saved.
--
-- Purely additive: it does not touch flight_statistics (the anonymous stats table),
-- profiles, or any existing policy/grant. Safe to run BEFORE the matching app code
-- is deployed (nothing reads or writes this table until that code is live).
--
-- Access model:
--   * A signed-in user reads, creates, updates and deletes their own rows (RLS), but
--     column-level grants stop them from touching the system columns (id, user_id on
--     update, source on update, created_at, thumbnail_url, share_token,
--     share_download_count).
--   * Sharing is NOT a "readable if the token matches" policy. The owner turns it on/off
--     through two SECURITY DEFINER functions; the public reads a shared plan only
--     through the /api/shared/[token] route, which uses the service role.

-- 1. Table -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.flight_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  -- Same strings as lib/flight-stats-service.ts uses for the two trackers, plus 'Sketch'
  -- for plans drawn on the drawing board.
  source TEXT NOT NULL CHECK (source IN ('FlightRadar24', 'FlightAware', 'Sketch')),
  -- Time of the last save of the plan's content (UTC): set on insert, bumped by the
  -- trigger below whenever the waypoints are saved again.
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  -- NULL when it can't be derived from the KML filename: never a guess or a placeholder.
  flight_number TEXT CHECK (flight_number IS NULL OR flight_number ~ '^[A-Z0-9]{1,12}$'),
  origin_airport TEXT NOT NULL CHECK (origin_airport ~ '^[A-Z]{4}$'),
  destination_airport TEXT NOT NULL CHECK (destination_airport ~ '^[A-Z]{4}$'),
  -- Resolved once, server-side, at save time (OurAirports data, see lib/airports.ts).
  -- NULL when the ICAO code isn't in the dataset.
  origin_airport_name TEXT CHECK (origin_airport_name IS NULL OR char_length(origin_airport_name) <= 200),
  destination_airport_name TEXT CHECK (destination_airport_name IS NULL OR char_length(destination_airport_name) <= 200),
  -- The generated flight plan itself: [{ name, lat, lng, altitude }, ...] with altitude in feet.
  -- Only derived data is stored, never the source KML.
  waypoints JSONB NOT NULL CHECK (
    jsonb_typeof(waypoints) = 'array'
    AND jsonb_array_length(waypoints) BETWEEN 2 AND 1000
    AND octet_length(waypoints::TEXT) <= 200000
  ),
  -- Whether MADE / WITH / INFINITE / PLANNER waypoints are in `waypoints`, exactly as
  -- they were when the plan was saved. Never recomputed afterwards.
  includes_branding BOOLEAN NOT NULL DEFAULT TRUE,
  -- Optional, entered by hand, always in whole minutes (never an interval).
  flight_time_minutes INTEGER CHECK (flight_time_minutes IS NULL OR flight_time_minutes BETWEEN 1 AND 5999),
  -- Reserved for later; stays NULL for every row in this phase.
  thumbnail_url TEXT,
  -- NULL = not shared. A random UUID = anyone with the link can view/download.
  share_token UUID,
  -- Counted server-side on each download through the share link. Not shown in any UI yet.
  share_download_count INTEGER NOT NULL DEFAULT 0
);

-- History page: newest first, per user (also covers lookups by user_id alone).
CREATE INDEX IF NOT EXISTS idx_flight_plans_user_created_at ON public.flight_plans (user_id, created_at DESC);
-- Share lookups. Unique so two plans can never answer to the same link.
CREATE UNIQUE INDEX IF NOT EXISTS uq_flight_plans_share_token ON public.flight_plans (share_token) WHERE share_token IS NOT NULL;

-- 2. created_at = last save ----------------------------------------------------
-- Clients have no UPDATE privilege on created_at, so the database stamps it itself,
-- and only when the plan's content was saved again: toggling sharing or editing the
-- flight time doesn't move a plan to the top of the history.
CREATE OR REPLACE FUNCTION public.flight_plans_stamp_save()
RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  IF NEW.waypoints IS DISTINCT FROM OLD.waypoints THEN
    NEW.created_at := NOW();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS flight_plans_stamp_save ON public.flight_plans;
CREATE TRIGGER flight_plans_stamp_save
  BEFORE UPDATE ON public.flight_plans
  FOR EACH ROW EXECUTE FUNCTION public.flight_plans_stamp_save();

-- 3. RLS + grants ----------------------------------------------------------------
ALTER TABLE public.flight_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read own flight plans" ON public.flight_plans;
DROP POLICY IF EXISTS "Insert own flight plans" ON public.flight_plans;
DROP POLICY IF EXISTS "Update own flight plans" ON public.flight_plans;
DROP POLICY IF EXISTS "Delete own flight plans" ON public.flight_plans;

-- The public (anon) key gets nothing at all on this table.
REVOKE ALL ON public.flight_plans FROM anon, authenticated;
GRANT SELECT, DELETE ON public.flight_plans TO authenticated;
-- Column-level grants: a plan's author supplies its content and nothing else.
GRANT INSERT (
  user_id, source, flight_number, origin_airport, destination_airport,
  origin_airport_name, destination_airport_name, waypoints, includes_branding, flight_time_minutes
) ON public.flight_plans TO authenticated;
GRANT UPDATE (
  flight_number, origin_airport, destination_airport,
  origin_airport_name, destination_airport_name, waypoints, includes_branding, flight_time_minutes
) ON public.flight_plans TO authenticated;

CREATE POLICY "Read own flight plans" ON public.flight_plans
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Insert own flight plans" ON public.flight_plans
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Update own flight plans" ON public.flight_plans
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Delete own flight plans" ON public.flight_plans
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- 4. Owner: start / stop sharing ---------------------------------------------------
-- SECURITY DEFINER because clients can't write share_token themselves (they could
-- otherwise pick a guessable token, or probe other plans' tokens through the unique
-- index). Each one only ever touches a row owned by the caller.

-- Returns the plan's link token, generating one only if it isn't shared yet: calling it
-- again while shared returns the existing token. NULL if the plan isn't the caller's.
CREATE OR REPLACE FUNCTION public.share_flight_plan(plan_id UUID)
RETURNS UUID
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
  UPDATE public.flight_plans
  SET share_token = COALESCE(share_token, gen_random_uuid())
  WHERE id = plan_id AND user_id = (SELECT auth.uid())
  RETURNING share_token;
$$;

-- Clears the token: the old link stops resolving at once, and sharing again later
-- generates a different token.
CREATE OR REPLACE FUNCTION public.unshare_flight_plan(plan_id UUID)
RETURNS VOID
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
  UPDATE public.flight_plans
  SET share_token = NULL
  WHERE id = plan_id AND user_id = (SELECT auth.uid());
$$;

REVOKE EXECUTE ON FUNCTION public.share_flight_plan(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.unshare_flight_plan(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.share_flight_plan(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unshare_flight_plan(UUID) TO authenticated;

-- 5. Public: one shared plan, by token ---------------------------------------------
-- Used only by the /api/shared/[token] routes (service role). Counts the download and
-- returns the plan in one atomic statement: no row for an unknown or revoked token.
-- Not executable by the public key or signed-in users.
CREATE OR REPLACE FUNCTION public.record_shared_download(p_token UUID)
RETURNS TABLE (
  origin_airport TEXT,
  destination_airport TEXT,
  flight_number TEXT,
  waypoints JSONB
)
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
  UPDATE public.flight_plans
  SET share_download_count = share_download_count + 1
  WHERE share_token = p_token
  RETURNING origin_airport, destination_airport, flight_number, waypoints;
$$;

REVOKE EXECUTE ON FUNCTION public.record_shared_download(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_shared_download(UUID) TO service_role;

-- Rollback (nothing else depends on these):
--   DROP FUNCTION public.record_shared_download(UUID);
--   DROP FUNCTION public.unshare_flight_plan(UUID);
--   DROP FUNCTION public.share_flight_plan(UUID);
--   DROP TABLE public.flight_plans;
--   DROP FUNCTION public.flight_plans_stamp_save();
