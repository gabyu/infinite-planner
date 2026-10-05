-- Follow-up to 20261006000000_link_discord_profile.sql.
--
-- When Discord is linked to an existing account, Supabase updates the account's metadata first and its
-- list of providers (raw_app_meta_data) right after, so the profile trigger - which only listened to
-- raw_user_meta_data - ran before the account counted as a Discord one and left the profile empty.
-- It now also listens to raw_app_meta_data, and the backfill runs again for accounts already linked.
--
-- Additive; role and must_change_password are never touched.

DROP TRIGGER IF EXISTS on_auth_user_updated_profile ON auth.users;
CREATE TRIGGER on_auth_user_updated_profile
  AFTER UPDATE OF raw_user_meta_data, raw_app_meta_data ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_discord_user();

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

-- Rollback: re-create the trigger with AFTER UPDATE OF raw_user_meta_data only.
