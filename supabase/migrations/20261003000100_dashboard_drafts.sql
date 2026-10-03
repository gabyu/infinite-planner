-- Dashboard + drafts: flight plans now have a lifecycle (draft -> exported), and the admin
-- activity heatmap reads flight_plans instead of the anonymous flight_statistics table.
--
-- Additive, and safe to run while the previous app version is still deployed:
--   * the previous code never sends `status`, so its rows get the default (see below) and keep
--     working; nothing it does is rejected except editing an already-exported plan,
--   * nothing here drops or renames a column.

-- 1. status --------------------------------------------------------------------
-- Every row that exists today was saved at the moment of an export (that was the only way
-- to create one), so it is 'exported'. The column is added with that default so the existing
-- rows are backfilled, then the default for NEW rows becomes 'draft'.
ALTER TABLE public.flight_plans
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'exported'
  CONSTRAINT flight_plans_status_check CHECK (status IN ('draft', 'exported'));

ALTER TABLE public.flight_plans ALTER COLUMN status SET DEFAULT 'draft';

-- Admin heatmap: all exported plans of all users, by time.
CREATE INDEX IF NOT EXISTS idx_flight_plans_exported_created_at
  ON public.flight_plans (created_at) WHERE status = 'exported';

-- A signed-in user may create a row as a draft or an exported plan, and flip draft -> exported
-- (the trigger below makes that one-way).
GRANT INSERT (status) ON public.flight_plans TO authenticated;
GRANT UPDATE (status) ON public.flight_plans TO authenticated;

-- 2. Exported plans are locked --------------------------------------------------
-- Once a plan is exported nothing about it can change, not just its waypoints: no content
-- edit, no flight time edit, and the status can never go back to 'draft'. To change it, the
-- user duplicates it (a new draft). What stays allowed on an exported plan: sharing /
-- unsharing (share_token, via the SECURITY DEFINER functions), the download counter
-- (service role) and deleting it.
--
-- created_at is "last save": the trigger moves it forward when the waypoints change, and when a
-- draft is exported (so an exported plan's created_at is its export time, which is what the
-- activity graphs count).
CREATE OR REPLACE FUNCTION public.flight_plans_stamp_save()
RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  IF OLD.status = 'exported' THEN
    IF NEW.status IS DISTINCT FROM OLD.status
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.source IS DISTINCT FROM OLD.source
       OR NEW.flight_number IS DISTINCT FROM OLD.flight_number
       OR NEW.origin_airport IS DISTINCT FROM OLD.origin_airport
       OR NEW.destination_airport IS DISTINCT FROM OLD.destination_airport
       OR NEW.origin_airport_name IS DISTINCT FROM OLD.origin_airport_name
       OR NEW.destination_airport_name IS DISTINCT FROM OLD.destination_airport_name
       OR NEW.waypoints IS DISTINCT FROM OLD.waypoints
       OR NEW.includes_branding IS DISTINCT FROM OLD.includes_branding
       OR NEW.flight_time_minutes IS DISTINCT FROM OLD.flight_time_minutes
    THEN
      RAISE EXCEPTION 'flight_plan_locked: an exported flight plan can no longer be changed'
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.waypoints IS DISTINCT FROM OLD.waypoints OR NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.created_at := NOW();
  END IF;
  RETURN NEW;
END;
$$;

-- (the trigger flight_plans_stamp_save from 20261003000000 already points at this function)

-- 3. Admin heatmap now reads flight_plans -------------------------------------------
-- Same signature and same contract as before (one timestamp per exported flight plan since
-- `since`, stable order so callers can page through it), but the source is flight_plans, so
-- it only counts plans exported by signed-in users from this phase on. There is no
-- backfill from flight_statistics.
CREATE OR REPLACE FUNCTION public.admin_flight_export_times(since TIMESTAMP WITH TIME ZONE)
RETURNS SETOF TIMESTAMP WITH TIME ZONE
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT f.created_at
  FROM public.flight_plans f
  WHERE public.is_admin() AND f.status = 'exported' AND f.created_at >= since
  ORDER BY f.created_at, f.id;
$$;

-- Rollback (restores the previous behaviour; keeps the data):
--   CREATE OR REPLACE FUNCTION public.admin_flight_export_times(...) reading public.flight_statistics
--     (see 20261002000000_profiles_and_admin.sql), and re-create flight_plans_stamp_save from
--     20261003000000_flight_plans.sql. Then optionally: ALTER TABLE public.flight_plans DROP COLUMN status.
