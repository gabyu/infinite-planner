-- The aircraft a flight plan is flown with ("Boeing 777-300ER"), kept in our system only: it is never written into the .fpl.
-- A name, not an Infinite Flight id, so an old plan still reads right if the game renames or drops an aircraft. Optional.
-- The list the person picks from comes live from the Infinite Flight Live API (never stored here); only their pick is.
--
-- Safe before the app code (nothing reads it yet). The app also copes with a database that lacks it (like extra_flight_numbers).
-- Rollback: ALTER TABLE public.flight_plans DROP COLUMN aircraft;
ALTER TABLE public.flight_plans
  ADD COLUMN IF NOT EXISTS aircraft TEXT;

ALTER TABLE public.flight_plans
  DROP CONSTRAINT IF EXISTS flight_plans_aircraft_check;
ALTER TABLE public.flight_plans
  ADD CONSTRAINT flight_plans_aircraft_check CHECK (
    aircraft IS NULL OR (char_length(aircraft) BETWEEN 1 AND 60 AND aircraft !~ '[[:cntrl:]]')
  );

-- Same column-level grants as the other editable fields (the table itself is revoked from authenticated).
GRANT INSERT (aircraft) ON public.flight_plans TO authenticated;
GRANT UPDATE (aircraft) ON public.flight_plans TO authenticated;
