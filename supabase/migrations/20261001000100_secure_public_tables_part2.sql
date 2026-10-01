-- Part 2/2 - run ONLY after the app code using get_flight_count() and an
-- insert without .select() is deployed on the target environment.
--
-- Closes direct reads of flight_statistics: the public key can now only
-- insert validated rows and call the aggregate functions.

DROP POLICY IF EXISTS "Public read (temporary)" ON public.flight_statistics;
REVOKE SELECT ON public.flight_statistics FROM anon, authenticated;
