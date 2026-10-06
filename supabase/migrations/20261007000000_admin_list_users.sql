-- Admin Users page: one row per user with their flight activity, searchable, sortable and paged
-- server-side so the page stays one query however many users there are.
--
-- Additive: a single new function, no table or policy is touched. Safe to run BEFORE the
-- matching app code is deployed (nothing calls it until that code is live).
--
-- Counts come from flight_plans, so they start at the history/dashboard release and a deleted
-- plan no longer counts. last_active is the latest save of any of the user's plans (draft or
-- exported), NULL for someone who never saved one.

CREATE OR REPLACE FUNCTION public.admin_list_users(
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
      p.created_at,
      COUNT(f.id) FILTER (WHERE f.status = 'exported') AS exported_count,
      COUNT(f.id) FILTER (WHERE f.status = 'draft') AS draft_count,
      COUNT(f.id) FILTER (WHERE f.share_token IS NOT NULL) AS shared_count,
      COALESCE(SUM(f.share_download_count), 0)::BIGINT AS share_downloads,
      MAX(f.created_at) AS last_active
    FROM public.profiles p
    LEFT JOIN public.flight_plans f ON f.user_id = p.id
    WHERE public.is_admin()
      AND p.role = 'user'
      AND (
        NULLIF(BTRIM(p_search), '') IS NULL
        -- % and _ typed by the admin are literal characters, not wildcards
        OR p.discord_username ILIKE '%' || REPLACE(REPLACE(REPLACE(BTRIM(p_search), '\', '\\'), '%', '\%'), '_', '\_') || '%'
      )
    GROUP BY p.id
  )
  SELECT s.id, s.discord_username, s.avatar_url, s.created_at, s.exported_count, s.draft_count,
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

-- Rollback (nothing depends on it):
--   DROP FUNCTION public.admin_list_users(TEXT, TEXT, TEXT, INTEGER, INTEGER);
