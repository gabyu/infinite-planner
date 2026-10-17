-- The front of Explore, edited by an admin: up to 6 flight plans pinned in order, each with an optional editor's note,
-- shown as a featured stage + a short rotating list at the top of the page. The rest of the list is filled in by
-- popularity, so the front is never empty or stale: a pinned plan that goes private, is hidden or deleted just drops out.
--
-- `section` names the editorial section. Only 'front' is used today; other sections (long-haul, short hops, a
-- monthly selection...) can be added later without changing this table.
--
-- Additive. Nothing here is reachable by the public key or by signed-in users: writes go through admin functions that
-- check is_admin(), and the page reads through list_explore_front (service role).

CREATE TABLE IF NOT EXISTS public.explore_picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section TEXT NOT NULL DEFAULT 'front' CHECK (section ~ '^[a-z0-9-]{1,40}$'),
  plan_id UUID NOT NULL REFERENCES public.flight_plans (id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position >= 0),
  note TEXT CHECK (note IS NULL OR char_length(note) <= 160),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  UNIQUE (section, plan_id)
);
CREATE INDEX IF NOT EXISTS idx_explore_picks_section_position ON public.explore_picks (section, position);
ALTER TABLE public.explore_picks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.explore_picks FROM anon, authenticated;

-- 1. Admin: the picks (with the ones that are no longer showable, flagged) -------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_picks(p_section TEXT DEFAULT 'front')
RETURNS TABLE (
  id UUID, plan_id UUID, public_id TEXT, origin_airport TEXT, destination_airport TEXT, flight_number TEXT,
  pick_position INTEGER, note TEXT, live BOOLEAN, author_name TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT k.id, k.plan_id, f.public_id, f.origin_airport, f.destination_airport, f.flight_number, k.position, k.note,
         (f.visibility = 'public' AND f.moderation_status = 'ok' AND f.status = 'exported'),
         COALESCE(p.discord_username, 'Infinite Planner admin')
  FROM public.explore_picks k
  JOIN public.flight_plans f ON f.id = k.plan_id
  JOIN public.profiles p ON p.id = f.user_id
  WHERE (SELECT public.is_admin()) AND k.section = p_section
  ORDER BY k.position;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_list_picks(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_picks(TEXT) TO authenticated;

-- 2. Admin: pin, unpin, reorder, edit the note -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_pin_plan(p_plan_id UUID, p_note TEXT DEFAULT NULL, p_section TEXT DEFAULT 'front')
RETURNS UUID
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  result UUID;
  taken INTEGER;
  max_picks CONSTANT INTEGER := 6;
BEGIN
  IF NOT (SELECT public.is_admin()) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = 'insufficient_privilege'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.flight_plans f
    WHERE f.id = p_plan_id AND f.visibility = 'public' AND f.moderation_status = 'ok' AND f.status = 'exported'
  ) THEN RAISE EXCEPTION 'plan_not_public' USING ERRCODE = 'check_violation'; END IF;
  IF EXISTS (SELECT 1 FROM public.explore_picks k WHERE k.section = p_section AND k.plan_id = p_plan_id) THEN
    RAISE EXCEPTION 'already_pinned' USING ERRCODE = 'unique_violation';
  END IF;
  SELECT count(*) INTO taken FROM public.explore_picks k WHERE k.section = p_section;
  IF taken >= max_picks THEN RAISE EXCEPTION 'too_many_picks' USING ERRCODE = 'check_violation'; END IF;

  INSERT INTO public.explore_picks (section, plan_id, position, note, created_by)
  VALUES (p_section, p_plan_id, taken, NULLIF(LEFT(btrim(COALESCE(p_note, '')), 160), ''), (SELECT auth.uid()))
  RETURNING id INTO result;
  RETURN result;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_pin_plan(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_pin_plan(UUID, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_unpin_pick(p_pick_id UUID)
RETURNS VOID
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  sec TEXT;
BEGIN
  IF NOT (SELECT public.is_admin()) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = 'insufficient_privilege'; END IF;
  DELETE FROM public.explore_picks k WHERE k.id = p_pick_id RETURNING k.section INTO sec;
  IF NOT FOUND THEN RAISE EXCEPTION 'pick_not_found' USING ERRCODE = 'P0002'; END IF;
  -- Close the gap: positions are 0, 1, 2... again.
  UPDATE public.explore_picks k SET position = r.rn
  FROM (SELECT x.id, (row_number() OVER (ORDER BY x.position) - 1)::INTEGER AS rn FROM public.explore_picks x WHERE x.section = sec) r
  WHERE k.id = r.id AND k.position <> r.rn;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_unpin_pick(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_unpin_pick(UUID) TO authenticated;

-- direction: -1 moves the pick up (towards the stage), +1 down.
CREATE OR REPLACE FUNCTION public.admin_move_pick(p_pick_id UUID, p_direction INTEGER)
RETURNS VOID
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  me public.explore_picks;
  neighbour public.explore_picks;
BEGIN
  IF NOT (SELECT public.is_admin()) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = 'insufficient_privilege'; END IF;
  SELECT * INTO me FROM public.explore_picks k WHERE k.id = p_pick_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'pick_not_found' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO neighbour FROM public.explore_picks k
  WHERE k.section = me.section AND k.position = me.position + SIGN(p_direction)::INTEGER;
  IF NOT FOUND THEN RETURN; END IF;
  UPDATE public.explore_picks k SET position = CASE WHEN k.id = me.id THEN neighbour.position ELSE me.position END
  WHERE k.id IN (me.id, neighbour.id);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_move_pick(UUID, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_move_pick(UUID, INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_pick_note(p_pick_id UUID, p_note TEXT)
RETURNS VOID
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT (SELECT public.is_admin()) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = 'insufficient_privilege'; END IF;
  UPDATE public.explore_picks k SET note = NULLIF(LEFT(btrim(COALESCE(p_note, '')), 160), '') WHERE k.id = p_pick_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'pick_not_found' USING ERRCODE = 'P0002'; END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_set_pick_note(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_pick_note(UUID, TEXT) TO authenticated;

-- 3. The page's read: pinned plans in order, then the most popular to fill ---------------------------------------
-- `route` is the flight with its first and last waypoints at full resolution and the middle thinned out; head_n and
-- tail_n say how many points at each end are the full-resolution ones (the camera zooms on them). Both are 0 for a
-- short flight (under 80 waypoints), which has nothing to zoom on.
CREATE OR REPLACE FUNCTION public.list_explore_front(p_limit INTEGER DEFAULT 6, p_section TEXT DEFAULT 'front')
RETURNS TABLE (
  id UUID, public_id TEXT, origin_airport TEXT, destination_airport TEXT, flight_number TEXT,
  distance_nm INTEGER, flight_time_minutes INTEGER, like_count INTEGER, import_count INTEGER, download_count INTEGER,
  created_at TIMESTAMP WITH TIME ZONE, author_name TEXT, author_avatar_url TEXT, author_public_id TEXT,
  route JSONB, head_n INTEGER, tail_n INTEGER, waypoint_count INTEGER, note TEXT, pinned BOOLEAN
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  WITH live AS (
    SELECT f.* FROM public.flight_plans f
    WHERE f.visibility = 'public' AND f.moderation_status = 'ok' AND f.status = 'exported'
  ),
  picked AS (
    SELECT l.id, k.position AS ord, k.note, TRUE AS pinned
    FROM public.explore_picks k JOIN live l ON l.id = k.plan_id
    WHERE k.section = p_section
    ORDER BY k.position LIMIT p_limit
  ),
  filled AS (
    SELECT l.id,
           1000 + row_number() OVER (
             ORDER BY (l.download_count + 10 * l.like_count + 5 * l.import_count)::DOUBLE PRECISION
                      / (GREATEST(EXTRACT(EPOCH FROM (NOW() - l.published_at)) / 86400.0, 0) + 1) DESC, l.id DESC
           ) AS ord,
           NULL::TEXT AS note, FALSE AS pinned
    FROM live l WHERE l.id NOT IN (SELECT id FROM picked)
  ),
  chosen AS (
    SELECT * FROM (SELECT * FROM picked UNION ALL SELECT * FROM filled) c ORDER BY ord LIMIT p_limit
  )
  SELECT l.id, l.public_id, l.origin_airport, l.destination_airport, l.flight_number, l.distance_nm, l.flight_time_minutes,
         l.like_count, l.import_count, l.download_count, l.created_at,
         p.discord_username, p.avatar_url, p.public_id,
         (SELECT jsonb_agg(jsonb_build_object(
                   'lat', (w ->> 'lat')::DOUBLE PRECISION,
                   'lng', (w ->> 'lng')::DOUBLE PRECISION,
                   'alt', COALESCE((w ->> 'altitude')::DOUBLE PRECISION, 0)) ORDER BY i)
          FROM jsonb_array_elements(l.waypoints) WITH ORDINALITY AS t(w, i)
          WHERE jsonb_array_length(l.waypoints) < 80
             OR i <= 40 OR i > jsonb_array_length(l.waypoints) - 40
             OR (i - 41) % GREATEST(1, CEIL((jsonb_array_length(l.waypoints) - 80) / 40.0)::INTEGER) = 0),
         CASE WHEN jsonb_array_length(l.waypoints) < 80 THEN 0 ELSE 40 END,
         CASE WHEN jsonb_array_length(l.waypoints) < 80 THEN 0 ELSE 40 END,
         jsonb_array_length(l.waypoints),
         c.note, c.pinned
  FROM chosen c
  JOIN live l ON l.id = c.id
  JOIN public.profiles p ON p.id = l.user_id
  ORDER BY c.ord;
$$;
REVOKE EXECUTE ON FUNCTION public.list_explore_front(INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_explore_front(INTEGER, TEXT) TO service_role;

-- Rollback: DROP FUNCTION public.list_explore_front(INTEGER, TEXT), public.admin_set_pick_note(UUID, TEXT),
--   public.admin_move_pick(UUID, INTEGER), public.admin_unpin_pick(UUID), public.admin_pin_plan(UUID, TEXT, TEXT),
--   public.admin_list_picks(TEXT); DROP TABLE public.explore_picks;
