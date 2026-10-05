-- A Discord identity linked to an EXISTING account (an admin created by e-mail who then signs in
-- with Discord using the same e-mail) now fills that account's profile too.
--
-- Until now handle_discord_user() only acted when the account's main provider was 'discord', i.e. for
-- accounts CREATED by a Discord login. A linked account keeps provider 'email', so its profile stayed
-- without a Discord name and its shared links showed the generic "Infinite Planner admin" author.
--
-- Additive and safe to run before the matching app code: it only widens when the profile's
-- Discord-sourced fields (discord_username, avatar_url) are refreshed. role and
-- must_change_password are never touched by this function.

CREATE OR REPLACE FUNCTION public.handle_discord_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  meta JSONB := COALESCE(NEW.raw_user_meta_data, '{}'::JSONB);
  has_discord BOOLEAN :=
    COALESCE(NEW.raw_app_meta_data ->> 'provider', '') = 'discord'
    OR COALESCE(NEW.raw_app_meta_data -> 'providers', '[]'::JSONB) ? 'discord';
BEGIN
  IF NOT has_discord THEN
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

-- Accounts already linked to Discord before this migration (e.g. the first admin): fill their profile now.
UPDATE public.profiles p
SET discord_username = LEFT(COALESCE(
      u.raw_user_meta_data ->> 'user_name',
      u.raw_user_meta_data ->> 'full_name',
      u.raw_user_meta_data -> 'custom_claims' ->> 'global_name',
      u.raw_user_meta_data ->> 'name'), 100),
    avatar_url = LEFT(u.raw_user_meta_data ->> 'avatar_url', 500)
FROM auth.users u
WHERE u.id = p.id
  AND p.discord_username IS NULL
  AND EXISTS (SELECT 1 FROM auth.identities i WHERE i.user_id = u.id AND i.provider = 'discord');

-- Rollback: re-create handle_discord_user() from 20261002000000_profiles_and_admin.sql (the
-- backfilled profile values can stay).
