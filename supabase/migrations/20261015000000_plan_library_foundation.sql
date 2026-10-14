-- Public flight plan library, step 1 (foundation): visibility, public ids, counters tables,
-- launch flag, and the two functions this step needs (set_plan_visibility, get_public_plan).
--
-- Additive, and safe to run BEFORE the matching app code: nothing existing is dropped or renamed,
-- the legacy share_flight_plan / unshare_flight_plan functions and share_token keep working, and
-- every new column is server-controlled (no column-level grant to `authenticated`).
--
-- Later steps (likes, imports, profile, reports...) add their functions in their own migrations;
-- the tables they need are created here so the schema lands in one reviewable piece.

-- 1. Public ids ----------------------------------------------------------------
-- 8 random chars from a 30-letter alphabet without ambiguous characters (no 0 o 1 i l u).
-- Every id ever issued is kept in the registry, so one is never handed out twice, even after
-- the plan or profile it belonged to is deleted.
CREATE TABLE IF NOT EXISTS public.public_id_registry (
  public_id TEXT PRIMARY KEY CHECK (public_id ~ '^[2-9a-hj-km-np-tv-z]{8}$'),
  issued_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
ALTER TABLE public.public_id_registry ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.public_id_registry FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.generate_public_id()
RETURNS TEXT
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  alphabet CONSTANT TEXT := '23456789abcdefghjkmnpqrstvwxyz';
  candidate TEXT;
  i INTEGER;
BEGIN
  LOOP
    candidate := '';
    FOR i IN 1..8 LOOP
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::INTEGER, 1);
    END LOOP;
    BEGIN
      INSERT INTO public.public_id_registry (public_id) VALUES (candidate);
      RETURN candidate;
    EXCEPTION WHEN unique_violation THEN
      -- Taken (ever): draw another one.
    END;
  END LOOP;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.generate_public_id() FROM PUBLIC, anon, authenticated;

-- 2. Profiles ------------------------------------------------------------------
-- (profiles.created_at already exists: see 20261002000000_profiles_and_admin.sql.)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS public_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS library_consent_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS publishing_blocked BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE public.profiles SET public_id = public.generate_public_id() WHERE public_id IS NULL;

CREATE OR REPLACE FUNCTION public.profiles_assign_public_id()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NEW.public_id IS NULL THEN
    NEW.public_id := public.generate_public_id();
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.profiles_assign_public_id() FROM PUBLIC, anon, authenticated;

-- A BEFORE INSERT trigger rather than an edit of handle_discord_user(): every path that creates a
-- profile (Discord sign-up, admin creation, bootstrap) gets an id without touching those functions.
DROP TRIGGER IF EXISTS profiles_assign_public_id ON public.profiles;
CREATE TRIGGER profiles_assign_public_id
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_assign_public_id();

ALTER TABLE public.profiles ALTER COLUMN public_id SET NOT NULL;

-- 3. flight_plans: library columns -------------------------------------------------
ALTER TABLE public.flight_plans
  ADD COLUMN IF NOT EXISTS public_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'private'
    CONSTRAINT flight_plans_visibility_check CHECK (visibility IN ('private', 'unlisted', 'public')),
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS distance_nm INTEGER,
  ADD COLUMN IF NOT EXISTS max_altitude_ft INTEGER,
  ADD COLUMN IF NOT EXISTS like_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS import_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS download_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS forked_from_id UUID REFERENCES public.flight_plans (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_fork BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS waypoints_hash TEXT,
  ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT FALSE
    CONSTRAINT flight_plans_featured_public CHECK (NOT featured OR visibility = 'public'),
  ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'ok'
    CONSTRAINT flight_plans_moderation_check CHECK (moderation_status IN ('ok', 'hidden'));

-- None of these columns is granted to `authenticated` (the existing grants are column lists), so
-- they change only through the SECURITY DEFINER functions below or the service role.

-- Library listing (step 3): public, newest first.
CREATE INDEX IF NOT EXISTS idx_flight_plans_public_published
  ON public.flight_plans (published_at DESC) WHERE visibility = 'public' AND moderation_status = 'ok';
CREATE INDEX IF NOT EXISTS idx_flight_plans_public_route
  ON public.flight_plans (origin_airport, destination_airport) WHERE visibility = 'public' AND moderation_status = 'ok';
CREATE INDEX IF NOT EXISTS idx_flight_plans_forked_from ON public.flight_plans (forked_from_id) WHERE forked_from_id IS NOT NULL;

-- 4. Helpers: distance, altitude, hash ----------------------------------------------
-- Great-circle distance along the waypoints, in nautical miles (haversine, R = 3440.065 NM).
CREATE OR REPLACE FUNCTION public.plan_distance_nm(p_waypoints JSONB)
RETURNS INTEGER
LANGUAGE sql IMMUTABLE SET search_path = ''
AS $$
  SELECT COALESCE(ROUND(SUM(
    2 * 3440.065 * asin(sqrt(least(1, greatest(0,
      power(sin(radians(lat - prev_lat) / 2), 2)
      + cos(radians(prev_lat)) * cos(radians(lat)) * power(sin(radians(lng - prev_lng) / 2), 2)
    ))))
  ))::INTEGER, 0)
  FROM (
    SELECT (w ->> 'lat')::DOUBLE PRECISION AS lat,
           (w ->> 'lng')::DOUBLE PRECISION AS lng,
           lag((w ->> 'lat')::DOUBLE PRECISION) OVER (ORDER BY ord) AS prev_lat,
           lag((w ->> 'lng')::DOUBLE PRECISION) OVER (ORDER BY ord) AS prev_lng
    FROM jsonb_array_elements(p_waypoints) WITH ORDINALITY AS t(w, ord)
  ) s
  WHERE prev_lat IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.plan_max_altitude_ft(p_waypoints JSONB)
RETURNS INTEGER
LANGUAGE sql IMMUTABLE SET search_path = ''
AS $$
  SELECT COALESCE(MAX((w ->> 'altitude')::NUMERIC)::INTEGER, 0) FROM jsonb_array_elements(p_waypoints) AS w;
$$;

CREATE OR REPLACE FUNCTION public.plan_waypoints_hash(p_waypoints JSONB)
RETURNS TEXT
LANGUAGE sql IMMUTABLE SET search_path = ''
AS $$
  SELECT md5(p_waypoints::TEXT);
$$;

-- 5. Counters tables ---------------------------------------------------------------
-- Created now, used by step 2 (likes / downloads / imports) and step 5 (reports). No direct
-- access for clients: users read their own rows through the functions that arrive with them.
CREATE TABLE IF NOT EXISTS public.plan_likes (
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.flight_plans (id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, plan_id)
);
CREATE INDEX IF NOT EXISTS idx_plan_likes_plan ON public.plan_likes (plan_id);

CREATE TABLE IF NOT EXISTS public.plan_downloads (
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.flight_plans (id) ON DELETE CASCADE,
  first_downloaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, plan_id)
);
CREATE INDEX IF NOT EXISTS idx_plan_downloads_plan ON public.plan_downloads (plan_id);

CREATE TABLE IF NOT EXISTS public.plan_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.flight_plans (id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN ('inappropriate', 'copyright', 'wrong_data', 'spam', 'other')),
  details TEXT CHECK (details IS NULL OR char_length(details) <= 500),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL
);
-- One open report per (user, plan).
CREATE UNIQUE INDEX IF NOT EXISTS uq_plan_reports_open ON public.plan_reports (reporter_id, plan_id) WHERE resolved_at IS NULL;

ALTER TABLE public.plan_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_downloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.plan_likes, public.plan_downloads, public.plan_reports FROM anon, authenticated;

-- Users read their own likes and downloads (the dashboard's Favorites tab); writes only via functions.
GRANT SELECT ON public.plan_likes, public.plan_downloads TO authenticated;
DROP POLICY IF EXISTS "Read own likes" ON public.plan_likes;
DROP POLICY IF EXISTS "Read own downloads" ON public.plan_downloads;
CREATE POLICY "Read own likes" ON public.plan_likes FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "Read own downloads" ON public.plan_downloads FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);

-- 6. Launch flag ---------------------------------------------------------------------
-- One row. While library_launched is FALSE only admins see the library (see lib/library.ts).
-- Flipped from the admin Settings page (step 6) or by hand in SQL; never by an env var.
CREATE TABLE IF NOT EXISTS public.app_settings (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CONSTRAINT app_settings_single_row CHECK (id),
  library_launched BOOLEAN NOT NULL DEFAULT FALSE,
  library_launched_at TIMESTAMP WITH TIME ZONE,
  library_target INTEGER NOT NULL DEFAULT 50 CHECK (library_target > 0)
);
INSERT INTO public.app_settings (id) VALUES (TRUE) ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_settings FROM anon, authenticated;

-- What the app (middleware and server) needs to know, readable by anyone: just the flag.
CREATE OR REPLACE FUNCTION public.library_state()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT library_launched FROM public.app_settings WHERE id;
$$;
REVOKE EXECUTE ON FUNCTION public.library_state() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.library_state() TO anon, authenticated, service_role;

-- 7. Migration of existing data ---------------------------------------------------------
-- An exported plan that was shared keeps working: it becomes 'unlisted' and gets a public id; its old
-- /shared/{token} link redirects to the new page. share_token stays (that is what the redirect looks up).
UPDATE public.flight_plans
SET public_id = public.generate_public_id(), visibility = 'unlisted'
WHERE share_token IS NOT NULL AND status = 'exported' AND public_id IS NULL;

-- A shared DRAFT (the dashboard never offered that, but nothing in the schema forbade it): its token is
-- dropped and it stays private. Only drafts that were ever shared are affected.
UPDATE public.flight_plans SET share_token = NULL WHERE share_token IS NOT NULL AND status = 'draft';

-- Every exported plan: derived figures and content hash (the fork republish guard compares hashes).
-- The lock trigger below forbids content edits on exported rows, none of these columns is part of it.
UPDATE public.flight_plans
SET distance_nm = public.plan_distance_nm(waypoints),
    max_altitude_ft = public.plan_max_altitude_ft(waypoints),
    waypoints_hash = public.plan_waypoints_hash(waypoints)
WHERE status = 'exported';

-- 8. Owner: change a plan's visibility ------------------------------------------------------
-- The only way to publish or unpublish. SECURITY DEFINER because clients can't write these columns.
-- Returns the plan's public id (NULL when it went back to private and never had one).
CREATE OR REPLACE FUNCTION public.set_plan_visibility(p_plan_id UUID, p_visibility TEXT)
RETURNS TABLE (public_id TEXT, visibility TEXT)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  uid UUID := (SELECT auth.uid());
  plan public.flight_plans%ROWTYPE;
  parent_hash TEXT;
  publications INTEGER;
  -- Max visibility changes to 'public' per user per 24 h. Change here to retune.
  max_publications CONSTANT INTEGER := 20;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not_signed_in' USING ERRCODE = '28000';
  END IF;
  IF p_visibility NOT IN ('private', 'unlisted', 'public') THEN
    RAISE EXCEPTION 'invalid_visibility' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO plan FROM public.flight_plans f WHERE f.id = p_plan_id AND f.user_id = uid FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'plan_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF plan.status <> 'exported' THEN
    RAISE EXCEPTION 'plan_not_exported: only an exported flight plan can be shared' USING ERRCODE = 'check_violation';
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
      public_id = CASE WHEN p_visibility = 'private' THEN f.public_id ELSE COALESCE(f.public_id, public.generate_public_id()) END,
      published_at = CASE
        WHEN p_visibility = 'public' THEN COALESCE(f.published_at, NOW())
        ELSE NULL
      END,
      featured = CASE WHEN p_visibility = 'public' THEN f.featured ELSE FALSE END,
      -- Going private also revokes the legacy /shared/{token} link.
      share_token = CASE WHEN p_visibility = 'private' THEN NULL ELSE f.share_token END,
      -- Figures are computed here, never taken from the client.
      distance_nm = COALESCE(f.distance_nm, public.plan_distance_nm(f.waypoints)),
      max_altitude_ft = COALESCE(f.max_altitude_ft, public.plan_max_altitude_ft(f.waypoints)),
      waypoints_hash = COALESCE(f.waypoints_hash, public.plan_waypoints_hash(f.waypoints))
  WHERE f.id = plan.id
  RETURNING f.public_id, f.visibility INTO public_id, visibility;

  RETURN NEXT;
END;
$$;

-- Log behind the 24 h publication limit (one row per plan made public).
CREATE TABLE IF NOT EXISTS public.plan_publication_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.flight_plans (id) ON DELETE CASCADE,
  at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_plan_publication_log_user_at ON public.plan_publication_log (user_id, at DESC);
ALTER TABLE public.plan_publication_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.plan_publication_log FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.set_plan_visibility(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_plan_visibility(UUID, TEXT) TO authenticated;

-- 9. Server render: one plan by public id ----------------------------------------------------
-- service_role only (the plan pages and the download route). Returns the plan when it is unlisted or
-- public and not hidden by moderation. Never returns user_id; the author is name + avatar only.
CREATE OR REPLACE FUNCTION public.get_public_plan(p_public_id TEXT)
RETURNS TABLE (
  public_id TEXT,
  visibility TEXT,
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE,
  source TEXT,
  flight_number TEXT,
  origin_airport TEXT,
  destination_airport TEXT,
  origin_airport_name TEXT,
  destination_airport_name TEXT,
  flight_time_minutes INTEGER,
  includes_branding BOOLEAN,
  waypoints JSONB,
  distance_nm INTEGER,
  max_altitude_ft INTEGER,
  like_count INTEGER,
  import_count INTEGER,
  download_count INTEGER,
  author_name TEXT,
  author_avatar_url TEXT,
  author_public_id TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT f.public_id, f.visibility, f.published_at, f.created_at, f.source, f.flight_number,
         f.origin_airport, f.destination_airport, f.origin_airport_name, f.destination_airport_name,
         f.flight_time_minutes, f.includes_branding, f.waypoints, f.distance_nm, f.max_altitude_ft,
         f.like_count, f.import_count, f.download_count,
         p.discord_username, p.avatar_url, p.public_id
  FROM public.flight_plans f
  JOIN public.profiles p ON p.id = f.user_id
  WHERE f.public_id = p_public_id
    AND f.visibility <> 'private'
    AND f.moderation_status = 'ok'
    AND f.status = 'exported';
$$;
REVOKE EXECUTE ON FUNCTION public.get_public_plan(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_plan(TEXT) TO service_role;

-- The legacy link: token -> public id (service role; the redirect on /shared/{token}).
CREATE OR REPLACE FUNCTION public.public_id_for_share_token(p_token UUID)
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT f.public_id FROM public.flight_plans f
  WHERE f.share_token = p_token AND f.visibility <> 'private' AND f.moderation_status = 'ok';
$$;
REVOKE EXECUTE ON FUNCTION public.public_id_for_share_token(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_id_for_share_token(UUID) TO service_role;

-- Download of a plan page (service role): returns the file's content and counts the legacy counter.
-- Per-user distinct counting arrives with step 2 (record_plan_download).
CREATE OR REPLACE FUNCTION public.record_public_download(p_public_id TEXT)
RETURNS TABLE (origin_airport TEXT, destination_airport TEXT, flight_number TEXT, waypoints JSONB)
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
  UPDATE public.flight_plans f
  SET share_download_count = f.share_download_count + 1
  WHERE f.public_id = p_public_id AND f.visibility <> 'private' AND f.moderation_status = 'ok' AND f.status = 'exported'
  RETURNING f.origin_airport, f.destination_airport, f.flight_number, f.waypoints;
$$;
REVOKE EXECUTE ON FUNCTION public.record_public_download(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_public_download(TEXT) TO service_role;

-- 10. Sitemap / hubs read model (service role): public plans only ----------------------------
CREATE OR REPLACE FUNCTION public.list_public_plan_stubs()
RETURNS TABLE (public_id TEXT, origin_airport TEXT, destination_airport TEXT, flight_number TEXT, published_at TIMESTAMP WITH TIME ZONE)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT f.public_id, f.origin_airport, f.destination_airport, f.flight_number, f.published_at
  FROM public.flight_plans f
  WHERE f.visibility = 'public' AND f.moderation_status = 'ok' AND f.status = 'exported'
  ORDER BY f.published_at DESC
  LIMIT 50000;
$$;
REVOKE EXECUTE ON FUNCTION public.list_public_plan_stubs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_public_plan_stubs() TO service_role;

-- Staging only (not part of the production rollout): open the library to everyone for QA.
--   UPDATE public.app_settings SET library_launched = TRUE, library_launched_at = NOW() WHERE id;
-- Emergency rollback of a launch in production:
--   UPDATE public.app_settings SET library_launched = FALSE WHERE id;
-- (then revalidate the `library` cache tag, or wait up to 5 minutes for the pages to refresh).

-- Rollback of this migration (nothing else depends on it; plans and the legacy share links are untouched):
--   DROP FUNCTION public.list_public_plan_stubs(); DROP FUNCTION public.record_public_download(TEXT);
--   DROP FUNCTION public.public_id_for_share_token(UUID); DROP FUNCTION public.get_public_plan(TEXT);
--   DROP FUNCTION public.set_plan_visibility(UUID, TEXT); DROP TABLE public.plan_publication_log;
--   DROP FUNCTION public.library_state(); DROP TABLE public.app_settings;
--   DROP TABLE public.plan_reports, public.plan_downloads, public.plan_likes;
--   ALTER TABLE public.flight_plans DROP COLUMN public_id, DROP COLUMN visibility, DROP COLUMN published_at,
--     DROP COLUMN distance_nm, DROP COLUMN max_altitude_ft, DROP COLUMN like_count, DROP COLUMN import_count,
--     DROP COLUMN download_count, DROP COLUMN forked_from_id, DROP COLUMN is_fork, DROP COLUMN waypoints_hash,
--     DROP COLUMN featured, DROP COLUMN moderation_status;
--   DROP TRIGGER profiles_assign_public_id ON public.profiles; DROP FUNCTION public.profiles_assign_public_id();
--   ALTER TABLE public.profiles DROP COLUMN public_id, DROP COLUMN library_consent_at, DROP COLUMN publishing_blocked;
--   DROP FUNCTION public.plan_waypoints_hash(JSONB), public.plan_max_altitude_ft(JSONB), public.plan_distance_nm(JSONB);
--   DROP FUNCTION public.generate_public_id(); DROP TABLE public.public_id_registry;
