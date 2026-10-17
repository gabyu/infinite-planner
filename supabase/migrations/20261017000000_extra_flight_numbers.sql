-- A flight often has more than one number (codeshares, a callsign next to the airline number). `flight_number`
-- stays the primary one (URLs, page titles, hubs, statistics); the others go in `extra_flight_numbers`, saved with
-- the plan by its author like the rest of its content. Additive: nothing else reads the column yet.
--
-- Rollback:
--   ALTER TABLE public.flight_plans DROP COLUMN extra_flight_numbers;

ALTER TABLE public.flight_plans
  ADD COLUMN IF NOT EXISTS extra_flight_numbers TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE public.flight_plans
  DROP CONSTRAINT IF EXISTS flight_plans_extra_flight_numbers_check;
ALTER TABLE public.flight_plans
  ADD CONSTRAINT flight_plans_extra_flight_numbers_check CHECK (
    cardinality(extra_flight_numbers) <= 5
    AND array_to_string(extra_flight_numbers, ',') ~ '^([A-Z0-9]{1,12}(,[A-Z0-9]{1,12})*)?$'
  );

-- Same column-level grants as flight_number: the author supplies it, nobody else.
GRANT INSERT (extra_flight_numbers) ON public.flight_plans TO authenticated;
GRANT UPDATE (extra_flight_numbers) ON public.flight_plans TO authenticated;
