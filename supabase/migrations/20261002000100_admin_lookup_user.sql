-- Lets the "Create admin" server route find an existing account by email, so it can offer
-- to promote a Discord account instead of failing with "email already exists".
-- Executable by the service role only: never by the public key or signed-in users.
--
-- Additive, safe to run before the matching app code is deployed.
CREATE OR REPLACE FUNCTION public.admin_lookup_user(lookup_email TEXT)
RETURNS TABLE (id UUID, role TEXT, has_discord BOOLEAN)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT
    u.id,
    p.role,
    EXISTS (SELECT 1 FROM auth.identities i WHERE i.user_id = u.id AND i.provider = 'discord')
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE lower(u.email) = lower(lookup_email)
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_lookup_user(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_lookup_user(TEXT) TO service_role;
