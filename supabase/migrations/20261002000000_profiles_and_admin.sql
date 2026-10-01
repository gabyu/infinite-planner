-- Accounts (Discord sign-in) and the admin dashboard.
--
-- Purely additive: it does not touch flight_statistics, its policies or its
-- grants. Admins read export timestamps through a SECURITY DEFINER function that
-- checks is_admin(), so the public key still cannot read that table.
--
-- Safe to run BEFORE the matching app code is deployed.

-- 1. profiles --------------------------------------------------------------
-- One row per account. Discord users are created by the trigger below; admins
-- are created by the server-side flow (service role) or bootstrapped by hand.
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  discord_username TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  -- IANA name (e.g. 'Europe/Paris'); NULL = use the browser-detected timezone.
  timezone TEXT CHECK (timezone IS NULL OR char_length(timezone) <= 64),
  must_change_password BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_role_created_at ON public.profiles (role, created_at DESC);

-- 2. Helper used by policies and admin functions ---------------------------
-- An admin who still has to change the temporary password is NOT an admin yet,
-- so the forced password change cannot be skipped by calling the API directly.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
      AND p.role = 'admin'
      AND NOT p.must_change_password
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- 3. RLS on profiles ---------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Update own profile" ON public.profiles;

-- No INSERT / DELETE policy: profiles are only created by the trigger or the
-- service role, and removed with the auth user (ON DELETE CASCADE).
REVOKE ALL ON public.profiles FROM anon, authenticated;
GRANT SELECT ON public.profiles TO authenticated;
-- Column-level grant: a signed-in user can change their own timezone and nothing
-- else, so role and must_change_password are server-controlled only.
GRANT UPDATE (timezone) ON public.profiles TO authenticated;

CREATE POLICY "Read own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = id);

CREATE POLICY "Admins read all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING ((SELECT public.is_admin()));

CREATE POLICY "Update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

-- 4. Discord sign-ups -> profiles ---------------------------------------------
-- Only Discord accounts get a profile here. Admin accounts are created with
-- auth.admin.createUser() (provider 'email'), so they are skipped and the
-- server-side flow inserts their profile explicitly with role 'admin'.
-- Never blocks authentication: on error it logs a warning and lets the login go on.
CREATE OR REPLACE FUNCTION public.handle_discord_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  meta JSONB := COALESCE(NEW.raw_user_meta_data, '{}'::JSONB);
BEGIN
  IF COALESCE(NEW.raw_app_meta_data ->> 'provider', '') <> 'discord' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.profiles (id, discord_username, avatar_url)
  VALUES (
    NEW.id,
    LEFT(COALESCE(meta ->> 'user_name', meta ->> 'full_name', meta -> 'custom_claims' ->> 'global_name', meta ->> 'name'), 100),
    LEFT(meta ->> 'avatar_url', 500)
  )
  -- Refresh Discord-sourced fields only: role / must_change_password stay untouched.
  ON CONFLICT (id) DO UPDATE
    SET discord_username = EXCLUDED.discord_username,
        avatar_url = EXCLUDED.avatar_url;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_discord_user failed for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_discord_user() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_discord_user();

DROP TRIGGER IF EXISTS on_auth_user_updated_profile ON auth.users;
CREATE TRIGGER on_auth_user_updated_profile
  AFTER UPDATE OF raw_user_meta_data ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_discord_user();

-- 5. Admin-only reads -----------------------------------------------------------
-- Emails live in auth.users, which the client can't read: expose them for admins only.
CREATE OR REPLACE FUNCTION public.admin_list_admins()
RETURNS TABLE (id UUID, email TEXT, created_at TIMESTAMP WITH TIME ZONE, must_change_password BOOLEAN)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT p.id, u.email::TEXT, p.created_at, p.must_change_password
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE p.role = 'admin' AND public.is_admin()
  ORDER BY p.created_at;
$$;

-- One timestamp per exported flight plan since `since`, for the activity heatmap.
-- The caller buckets them by day in the admin's own timezone. Stable order so
-- callers can page through it (PostgREST caps a response at 1000 rows).
CREATE OR REPLACE FUNCTION public.admin_flight_export_times(since TIMESTAMP WITH TIME ZONE)
RETURNS SETOF TIMESTAMP WITH TIME ZONE
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT f.created_at
  FROM public.flight_statistics f
  WHERE public.is_admin() AND f.created_at >= since
  ORDER BY f.created_at, f.id;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_list_admins() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_flight_export_times(TIMESTAMP WITH TIME ZONE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_admins() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_flight_export_times(TIMESTAMP WITH TIME ZONE) TO authenticated;
