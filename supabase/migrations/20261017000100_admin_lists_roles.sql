-- Admin lists follow the role ladder: public < Discord account < contributor < admin.
--
-- * Admins: the list also returns the admin's Discord name and avatar (an admin is created by e-mail and links Discord).
-- * Discord members: the list now includes contributors and admins, with their role, so nobody disappears from it.
-- * Contributors: the list also shows the admins (every admin is a contributor by default), with their role. Only a
--   'contributor' can be demoted; an admin never is.
--
-- The three functions change their return type, so they are dropped and re-created. Read-only, no table or policy is
-- touched. The old app code ignores the extra columns, but the Discord members list then also shows admins and
-- contributors: run this together with the matching code.

-- 1. Admins ---------------------------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.admin_list_admins();
CREATE FUNCTION public.admin_list_admins()
RETURNS TABLE (
  id UUID,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  must_change_password BOOLEAN,
  discord_username TEXT,
  avatar_url TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT p.id, u.email::TEXT, p.created_at, p.must_change_password, p.discord_username, p.avatar_url
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE p.role = 'admin' AND public.is_admin()
  ORDER BY p.created_at;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_list_admins() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_admins() TO authenticated;

-- 2. Discord members: every role, as long as the account has a Discord profile ------------------------------------
DROP FUNCTION IF EXISTS public.admin_list_users(TEXT, TEXT, TEXT, INTEGER, INTEGER);
CREATE FUNCTION public.admin_list_users(
  p_search TEXT DEFAULT NULL,
  p_sort TEXT DEFAULT 'signed_up',   -- name | signed_up | exported | drafts | shared | last_active
  p_dir TEXT DEFAULT 'desc',         -- asc | desc
  p_limit INTEGER DEFAULT 25,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  discord_username TEXT,
  avatar_url TEXT,
  role TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  exported_count BIGINT,
  draft_count BIGINT,
  shared_count BIGINT,
  share_downloads BIGINT,
  last_active TIMESTAMP WITH TIME ZONE,
  total_count BIGINT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  WITH stats AS (
    SELECT
      p.id,
      p.discord_username,
      p.avatar_url,
      p.role,
      p.created_at,
      COUNT(f.id) FILTER (WHERE f.status = 'exported') AS exported_count,
      COUNT(f.id) FILTER (WHERE f.status = 'draft') AS draft_count,
      COUNT(f.id) FILTER (WHERE f.share_token IS NOT NULL) AS shared_count,
      COALESCE(SUM(f.share_download_count), 0)::BIGINT AS share_downloads,
      MAX(f.created_at) AS last_active
    FROM public.profiles p
    LEFT JOIN public.flight_plans f ON f.user_id = p.id
    WHERE public.is_admin()
      AND p.discord_username IS NOT NULL
      AND (
        NULLIF(BTRIM(p_search), '') IS NULL
        -- % and _ typed by the admin are literal characters, not wildcards
        OR p.discord_username ILIKE '%' || REPLACE(REPLACE(REPLACE(BTRIM(p_search), '\', '\\'), '%', '\%'), '_', '\_') || '%'
      )
    GROUP BY p.id
  )
  SELECT s.id, s.discord_username, s.avatar_url, s.role, s.created_at, s.exported_count, s.draft_count,
         s.shared_count, s.share_downloads, s.last_active, COUNT(*) OVER () AS total_count
  FROM stats s
  ORDER BY
    CASE WHEN p_dir = 'asc' THEN (CASE p_sort WHEN 'exported' THEN s.exported_count WHEN 'drafts' THEN s.draft_count WHEN 'shared' THEN s.shared_count END) END ASC NULLS LAST,
    CASE WHEN p_dir <> 'asc' THEN (CASE p_sort WHEN 'exported' THEN s.exported_count WHEN 'drafts' THEN s.draft_count WHEN 'shared' THEN s.shared_count END) END DESC NULLS LAST,
    CASE WHEN p_dir = 'asc' THEN (CASE p_sort WHEN 'name' THEN LOWER(s.discord_username) END) END ASC NULLS LAST,
    CASE WHEN p_dir <> 'asc' THEN (CASE p_sort WHEN 'name' THEN LOWER(s.discord_username) END) END DESC NULLS LAST,
    CASE WHEN p_dir = 'asc' THEN (CASE p_sort WHEN 'last_active' THEN s.last_active WHEN 'signed_up' THEN s.created_at END) END ASC NULLS LAST,
    CASE WHEN p_dir <> 'asc' THEN (CASE p_sort WHEN 'last_active' THEN s.last_active WHEN 'signed_up' THEN s.created_at END) END DESC NULLS LAST,
    s.created_at DESC, s.id
  LIMIT GREATEST(p_limit, 1) OFFSET GREATEST(p_offset, 0);
$$;
REVOKE EXECUTE ON FUNCTION public.admin_list_users(TEXT, TEXT, TEXT, INTEGER, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_users(TEXT, TEXT, TEXT, INTEGER, INTEGER) TO authenticated;

-- 3. Contributors: contributors and admins, each with their role -------------------------------------------------
DROP FUNCTION IF EXISTS public.admin_list_contributors();
CREATE FUNCTION public.admin_list_contributors()
RETURNS TABLE (
  id UUID,
  discord_username TEXT,
  avatar_url TEXT,
  role TEXT,
  contributor_since TIMESTAMP WITH TIME ZONE,
  published_count BIGINT,
  downloads_received BIGINT,
  likes_received BIGINT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT p.id, p.discord_username, p.avatar_url, p.role, p.contributor_since,
         COUNT(f.id) FILTER (WHERE f.visibility = 'public' AND f.moderation_status = 'ok' AND f.status = 'exported'),
         COALESCE(SUM(f.download_count) FILTER (WHERE f.visibility = 'public'), 0)::BIGINT,
         COALESCE(SUM(f.like_count) FILTER (WHERE f.visibility = 'public'), 0)::BIGINT
  FROM public.profiles p
  LEFT JOIN public.flight_plans f ON f.user_id = p.id
  WHERE (SELECT public.is_admin())
    AND (p.role = 'contributor' OR (p.role = 'admin' AND p.discord_username IS NOT NULL))
  GROUP BY p.id
  -- Contributors first (newest first), then the admins, who are contributors by default.
  ORDER BY (p.role = 'admin'), p.contributor_since DESC NULLS LAST, p.created_at DESC;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_list_contributors() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_contributors() TO authenticated;

-- Rollback: re-create the three functions from 20261002000000_profiles_and_admin.sql (admin_list_admins),
-- 20261007000000_admin_list_users.sql and 20261016000000_contributor_role.sql (after dropping these ones).
