-- Airport procedures: the admin-only database of how real flights arrive at and leave an airport, built from flight files
-- (one analysed row per flight and airport). Used to see what each airport has and what it still lacks.
--
-- Rules it keeps:
--   * ADMINS ONLY. No table here is granted to anon or authenticated; every read and write goes through an admin_* function
--     that checks is_admin() itself (contributors are not admins). Nothing public, no plan, no library page reads these tables.
--   * Every row is marked tracker-derived and the database refuses anything else (CHECK (tracker_derived)). The flight files
--     come from third-party trackers. "Imported" is a SHAREABLE source in this database (20261018000100), so it is not used
--     here. A later migration lifts the lock only once there is a source that is not a tracker's.
--   * Only a light track is kept: at most 200 points of [lat, lng, feet] within 60 NM of the airport. No flight number,
--     registration, time or photo, and never the file itself (the app analyses it in memory and drops it).
--   * No foreign key to profiles: staging and prod have different accounts, and the rows are copied from prod to staging.
--
-- Safe before the app code: it adds tables and functions, changes nothing that exists, deletes nothing.
-- Needs is_admin() from 20261002000000_profiles_and_admin.

-- 1. Track validation ------------------------------------------------------------------------------------------------------
-- [[lat, lng, feet], ...]: 2 to 200 points, within range, at most 14 kB. Anything else is refused whatever the caller says.
CREATE OR REPLACE FUNCTION public.is_valid_procedure_track(p_track JSONB)
RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_track IS NULL OR jsonb_typeof(p_track) <> 'array' THEN FALSE
    WHEN jsonb_array_length(p_track) NOT BETWEEN 2 AND 200 THEN FALSE
    WHEN octet_length(p_track::TEXT) > 14000 THEN FALSE
    ELSE NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_track) AS e
      WHERE NOT (
        CASE WHEN jsonb_typeof(e) = 'array' AND jsonb_array_length(e) = 3
              AND jsonb_typeof(e -> 0) = 'number' AND jsonb_typeof(e -> 1) = 'number' AND jsonb_typeof(e -> 2) = 'number'
          THEN (e ->> 0)::NUMERIC BETWEEN -90 AND 90 AND (e ->> 1)::NUMERIC BETWEEN -180 AND 180 AND (e ->> 2)::NUMERIC BETWEEN -1000 AND 60000
          ELSE FALSE END
      )
    )
  END;
$$;

-- 2. Tables ----------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.procedure_flights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The airport this row is about. A flight gives two rows: a departure at its origin, an arrival at its destination.
  airport TEXT NOT NULL CHECK (airport ~ '^[A-Z]{4}$'),
  -- "unknown": the flight does not touch this airport on the ground (a track that begins in the air).
  kind TEXT NOT NULL CHECK (kind IN ('arrival', 'departure', 'unknown')),
  -- The runway end used ("08L"), NULL when it could not be told or the person left it as "XX".
  runway TEXT CHECK (runway IS NULL OR runway ~ '^(0[1-9]|[12][0-9]|3[0-6])[LRC]?$'),
  needs_check BOOLEAN NOT NULL DEFAULT FALSE,
  -- "LFPG-LSGG": where the flight went from and to; "????" for an end that is not a known airport.
  route TEXT NOT NULL CHECK (route ~ '^[A-Z?]{4}-[A-Z?]{4}$'),
  -- Arrival: bearing from the runway to where the flight crossed 40 NM. Departure: bearing to the top of climb.
  bearing SMALLINT CHECK (bearing IS NULL OR bearing BETWEEN 0 AND 359),
  -- Top of descent (arrival) or top of climb (departure), NM from the runway.
  turn_nm SMALLINT CHECK (turn_nm IS NULL OR turn_nm BETWEEN 0 AND 2000),
  -- Arrival: distance from which the flight stays on the extended centreline.
  established_nm NUMERIC(4, 1) CHECK (established_nm IS NULL OR established_nm BETWEEN 0 AND 100),
  -- Altitude in feet at 30, 20, 15, 10 and 5 NM from the runway (arrivals).
  alt_profile JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(alt_profile) = 'object' AND octet_length(alt_profile::TEXT) <= 400),
  track JSONB NOT NULL CHECK (public.is_valid_procedure_track(track)),
  flags TEXT[] NOT NULL DEFAULT '{}'::TEXT[] CHECK (cardinality(flags) <= 10 AND octet_length(array_to_string(flags, '|')) <= 1200),
  -- sha256 of the file, to refuse the same flight twice. The file itself is never kept.
  content_hash TEXT NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  tracker_derived BOOLEAN NOT NULL DEFAULT TRUE CHECK (tracker_derived),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (airport, content_hash)
);
CREATE INDEX IF NOT EXISTS idx_procedure_flights_airport ON public.procedure_flights (airport);

-- A direction nobody flies ("arrival|04|N"), or a whole kind called finished ("done|arrival").
CREATE TABLE IF NOT EXISTS public.procedure_marks (
  airport TEXT NOT NULL CHECK (airport ~ '^[A-Z]{4}$'),
  key TEXT NOT NULL CHECK (key ~ '^((arrival|departure)\|[0-9]{2}\|(N|NE|E|SE|S|SW|W|NW)|done\|(arrival|departure))$'),
  PRIMARY KEY (airport, key)
);

-- When this database was last copied from production (staging only; production never has a row).
CREATE TABLE IF NOT EXISTS public.procedure_sync_state (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  last_synced_at TIMESTAMP WITH TIME ZONE NOT NULL,
  flights_count INTEGER NOT NULL DEFAULT 0
);

-- The safety catch of the copy: procedure_sync_import() refuses to run unless this table has its row. The row is created BY
-- HAND on staging only ("INSERT INTO public.procedure_sync_allowed DEFAULT VALUES;"), never in a migration, so a mistake
-- can never overwrite production.
CREATE TABLE IF NOT EXISTS public.procedure_sync_allowed (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id)
);

-- 3. Access: nothing directly, everything through the functions below -------------------------------------------------------------
ALTER TABLE public.procedure_flights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procedure_marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procedure_sync_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procedure_sync_allowed ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.procedure_flights, public.procedure_marks, public.procedure_sync_state, public.procedure_sync_allowed FROM anon, authenticated;

-- 4. Admin reads ------------------------------------------------------------------------------------------------------------------
-- One light row per flight and airport (no track): the page computes each airport's progress from these.
CREATE OR REPLACE FUNCTION public.admin_procedure_overview()
RETURNS TABLE (airport TEXT, kind TEXT, runway TEXT, bearing SMALLINT, route TEXT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  RETURN QUERY SELECT f.airport, f.kind, f.runway, f.bearing, f.route FROM public.procedure_flights f;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_procedure_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_procedure_overview() TO authenticated;

-- The whole rows of one airport, with their tracks.
CREATE OR REPLACE FUNCTION public.admin_list_procedure_flights(p_airport TEXT)
RETURNS TABLE (
  id UUID, airport TEXT, kind TEXT, runway TEXT, needs_check BOOLEAN, route TEXT, bearing SMALLINT, turn_nm SMALLINT,
  established_nm NUMERIC, alt_profile JSONB, track JSONB, flags TEXT[], created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF p_airport IS NULL OR p_airport !~ '^[A-Z]{4}$' THEN RAISE EXCEPTION 'invalid_airport' USING ERRCODE = '22023'; END IF;
  RETURN QUERY
    SELECT f.id, f.airport, f.kind, f.runway, f.needs_check, f.route, f.bearing, f.turn_nm, f.established_nm, f.alt_profile,
           f.track, f.flags, f.created_at
    FROM public.procedure_flights f WHERE f.airport = p_airport ORDER BY f.created_at, f.id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_list_procedure_flights(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_procedure_flights(TEXT) TO authenticated;

-- The marks of one airport, or of every airport when none is given.
CREATE OR REPLACE FUNCTION public.admin_list_procedure_marks(p_airport TEXT DEFAULT NULL)
RETURNS TABLE (airport TEXT, key TEXT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  RETURN QUERY SELECT m.airport, m.key FROM public.procedure_marks m WHERE p_airport IS NULL OR m.airport = p_airport;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_list_procedure_marks(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_procedure_marks(TEXT) TO authenticated;

-- Staging: when the data was last copied from production, and whether a copy is allowed here at all.
CREATE OR REPLACE FUNCTION public.admin_procedure_sync_state()
RETURNS TABLE (copy_allowed BOOLEAN, last_synced_at TIMESTAMP WITH TIME ZONE, flights_count INTEGER)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  RETURN QUERY
    SELECT EXISTS (SELECT 1 FROM public.procedure_sync_allowed), s.last_synced_at, s.flights_count
    FROM (SELECT 1) AS one LEFT JOIN public.procedure_sync_state s ON TRUE;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_procedure_sync_state() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_procedure_sync_state() TO authenticated;

-- 5. Admin writes -----------------------------------------------------------------------------------------------------------------
-- Adds analysed rows (up to 4 at a time: one file gives at most two). The same flight twice in an airport is skipped, not
-- an error. Every value is checked by the table's own constraints. At most 20000 rows in all.
CREATE OR REPLACE FUNCTION public.admin_add_procedure_flights(p_rows JSONB)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  added INTEGER;
  total INTEGER;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) NOT BETWEEN 1 AND 4 THEN
    RAISE EXCEPTION 'invalid_rows' USING ERRCODE = '22023';
  END IF;
  IF (SELECT count(*) FROM public.procedure_flights) >= 20000 THEN RAISE EXCEPTION 'too_many_rows' USING ERRCODE = 'check_violation'; END IF;

  total := jsonb_array_length(p_rows);
  INSERT INTO public.procedure_flights (
    airport, kind, runway, needs_check, route, bearing, turn_nm, established_nm, alt_profile, track, flags, content_hash
  )
  SELECT r.airport, r.kind, NULLIF(r.runway, ''), COALESCE(r.needs_check, FALSE), r.route, r.bearing, r.turn_nm, r.established_nm,
         COALESCE(r.alt_profile, '{}'::JSONB), r.track, COALESCE(r.flags, '{}'::TEXT[]), r.content_hash
  FROM jsonb_to_recordset(p_rows) AS r (
    airport TEXT, kind TEXT, runway TEXT, needs_check BOOLEAN, route TEXT, bearing SMALLINT, turn_nm SMALLINT,
    established_nm NUMERIC, alt_profile JSONB, track JSONB, flags TEXT[], content_hash TEXT
  )
  ON CONFLICT (airport, content_hash) DO NOTHING;
  GET DIAGNOSTICS added = ROW_COUNT;
  RETURN jsonb_build_object('added', added, 'skipped', total - added);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_add_procedure_flights(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_add_procedure_flights(JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_delete_procedure_flight(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  DELETE FROM public.procedure_flights WHERE id = p_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_delete_procedure_flight(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_procedure_flight(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_procedure_mark(p_airport TEXT, p_key TEXT, p_on BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF p_on THEN
    INSERT INTO public.procedure_marks (airport, key) VALUES (p_airport, p_key) ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.procedure_marks WHERE airport = p_airport AND key = p_key;
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_set_procedure_mark(TEXT, TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_procedure_mark(TEXT, TEXT, BOOLEAN) TO authenticated;

-- 6. Copy from production to staging ------------------------------------------------------------------------------------------------
-- Service role only: not granted to authenticated, so no signed-in person (admin or not) can call them from a browser.
CREATE OR REPLACE FUNCTION public.procedure_sync_export()
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'flights', COALESCE((SELECT jsonb_agg(to_jsonb(f) ORDER BY f.created_at, f.id) FROM public.procedure_flights f), '[]'::JSONB),
    'marks', COALESCE((SELECT jsonb_agg(to_jsonb(m) ORDER BY m.airport, m.key) FROM public.procedure_marks m), '[]'::JSONB)
  );
$$;
REVOKE EXECUTE ON FUNCTION public.procedure_sync_export() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.procedure_sync_export() TO service_role;

-- Replaces everything here with the given export, in one transaction. Refuses unless the safety catch row exists (staging only).
CREATE OR REPLACE FUNCTION public.procedure_sync_import(p_data JSONB)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  imported INTEGER;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.procedure_sync_allowed) THEN RAISE EXCEPTION 'sync_not_allowed' USING ERRCODE = '42501'; END IF;
  IF p_data IS NULL OR jsonb_typeof(p_data -> 'flights') <> 'array' OR jsonb_typeof(p_data -> 'marks') <> 'array' THEN
    RAISE EXCEPTION 'invalid_export' USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.procedure_flights;
  DELETE FROM public.procedure_marks;

  INSERT INTO public.procedure_flights (
    id, airport, kind, runway, needs_check, route, bearing, turn_nm, established_nm, alt_profile, track, flags, content_hash,
    tracker_derived, created_at
  )
  SELECT r.id, r.airport, r.kind, r.runway, r.needs_check, r.route, r.bearing, r.turn_nm, r.established_nm, r.alt_profile, r.track,
         r.flags, r.content_hash, r.tracker_derived, r.created_at
  FROM jsonb_to_recordset(p_data -> 'flights') AS r (
    id UUID, airport TEXT, kind TEXT, runway TEXT, needs_check BOOLEAN, route TEXT, bearing SMALLINT, turn_nm SMALLINT,
    established_nm NUMERIC, alt_profile JSONB, track JSONB, flags TEXT[], content_hash TEXT, tracker_derived BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
  );
  GET DIAGNOSTICS imported = ROW_COUNT;

  INSERT INTO public.procedure_marks (airport, key)
  SELECT r.airport, r.key FROM jsonb_to_recordset(p_data -> 'marks') AS r (airport TEXT, key TEXT);

  INSERT INTO public.procedure_sync_state (id, last_synced_at, flights_count) VALUES (TRUE, NOW(), imported)
  ON CONFLICT (id) DO UPDATE SET last_synced_at = EXCLUDED.last_synced_at, flights_count = EXCLUDED.flights_count;
  RETURN jsonb_build_object('flights', imported);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.procedure_sync_import(JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.procedure_sync_import(JSONB) TO service_role;

-- Staging only, by hand, once the copy button should work there:
--   INSERT INTO public.procedure_sync_allowed DEFAULT VALUES;
--
-- Rollback: DROP FUNCTION public.procedure_sync_import(JSONB); DROP FUNCTION public.procedure_sync_export();
-- DROP FUNCTION public.admin_set_procedure_mark(TEXT, TEXT, BOOLEAN); DROP FUNCTION public.admin_delete_procedure_flight(UUID);
-- DROP FUNCTION public.admin_add_procedure_flights(JSONB); DROP FUNCTION public.admin_procedure_sync_state();
-- DROP FUNCTION public.admin_list_procedure_marks(TEXT); DROP FUNCTION public.admin_list_procedure_flights(TEXT);
-- DROP FUNCTION public.admin_procedure_overview(); DROP TABLE public.procedure_sync_allowed, public.procedure_sync_state,
-- public.procedure_marks, public.procedure_flights; DROP FUNCTION public.is_valid_procedure_track(JSONB).
