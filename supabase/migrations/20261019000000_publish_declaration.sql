-- Publish declaration record: every publish of an Imported plan stores who declared what, when, in the same
-- transaction as the publish. Replaces declare_import_rights (a separate step that could be skipped or fail alone).
--
-- Order matters on a live system: the previous app version keeps working except for publishing an Imported plan, which
-- needs the new app (its declaration step called the dropped function). Run, then deploy straight away.
-- Nothing is deleted.

-- 1. The record ------------------------------------------------------------------------------------------------------
-- No IP address, no device data. wording_key = the copy key plus a version, never the text itself.
CREATE TABLE IF NOT EXISTS public.plan_declarations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.flight_plans (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  declared_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  wording_key TEXT NOT NULL CHECK (char_length(wording_key) BETWEEN 1 AND 80),
  origin_sources TEXT[] NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_plan_declarations_plan ON public.plan_declarations (plan_id, declared_at DESC);
ALTER TABLE public.plan_declarations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.plan_declarations FROM anon, authenticated;

-- Declarations made with the earlier step (import_declared_at) keep a record, marked with a wording that says so.
INSERT INTO public.plan_declarations (plan_id, user_id, declared_at, wording_key, origin_sources)
SELECT f.id, f.user_id, f.import_declared_at, 'legacy-declaration@0', f.origin_sources
FROM public.flight_plans f
WHERE f.import_declared_at IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.plan_declarations d WHERE d.plan_id = f.id);

DROP FUNCTION IF EXISTS public.declare_import_rights(UUID);

-- 2. set_plan_visibility records the declaration in the same transaction --------------------------------------------------
-- A new optional argument: the previous app version (two named arguments) still resolves to this function.
-- Going public with an Imported origin needs the key and writes the record; going private forgets the declaration, so a
-- republish asks again. An exported plan can't be edited (it is duplicated into a new plan, which has no declaration).
DROP FUNCTION IF EXISTS public.set_plan_visibility(UUID, TEXT);
CREATE OR REPLACE FUNCTION public.set_plan_visibility(p_plan_id UUID, p_visibility TEXT, p_declaration_key TEXT DEFAULT NULL)
RETURNS TABLE (public_id TEXT, visibility TEXT)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  uid UUID := (SELECT auth.uid());
  plan public.flight_plans%ROWTYPE;
  parent_hash TEXT;
  publications INTEGER;
  max_publications CONSTANT INTEGER := 20;
  imported BOOLEAN;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not_signed_in' USING ERRCODE = '28000';
  END IF;
  IF p_visibility NOT IN ('private', 'public') THEN
    RAISE EXCEPTION 'invalid_visibility' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO plan FROM public.flight_plans f WHERE f.id = p_plan_id AND f.user_id = uid FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'plan_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF plan.status <> 'exported' THEN
    RAISE EXCEPTION 'plan_not_exported: only an exported flight plan can be made public' USING ERRCODE = 'check_violation';
  END IF;
  imported := 'Imported' = ANY (plan.origin_sources);

  IF p_visibility = 'public' THEN
    IF public.is_tracker_derived(plan.origin_sources) THEN
      RAISE EXCEPTION 'tracker_derived: only a flight plan that does not come from a tracker export can be published' USING ERRCODE = 'check_violation';
    END IF;
    IF imported AND plan.visibility <> 'public' AND p_declaration_key IS NULL THEN
      RAISE EXCEPTION 'declaration_required: confirm you have the right to share this flight plan' USING ERRCODE = 'check_violation';
    END IF;
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
      IF imported THEN
        -- Same transaction as the publish: if this fails, so does the publish.
        INSERT INTO public.plan_declarations (plan_id, user_id, wording_key, origin_sources)
        VALUES (plan.id, uid, p_declaration_key, plan.origin_sources);
      END IF;
    END IF;
  END IF;

  UPDATE public.flight_plans f
  SET visibility = p_visibility,
      public_id = CASE WHEN p_visibility = 'private' THEN f.public_id ELSE COALESCE(f.public_id, public.generate_public_id()) END,
      published_at = CASE WHEN p_visibility = 'public' THEN COALESCE(f.published_at, NOW()) ELSE NULL END,
      featured = CASE WHEN p_visibility = 'public' THEN f.featured ELSE FALSE END,
      import_declared_at = CASE
        WHEN p_visibility = 'private' THEN NULL
        WHEN imported AND f.visibility <> 'public' THEN NOW()
        ELSE f.import_declared_at END,
      distance_nm = COALESCE(f.distance_nm, public.plan_distance_nm(f.waypoints)),
      max_altitude_ft = COALESCE(f.max_altitude_ft, public.plan_max_altitude_ft(f.waypoints)),
      waypoints_hash = COALESCE(f.waypoints_hash, public.plan_waypoints_hash(f.waypoints))
  WHERE f.id = plan.id
  RETURNING f.public_id, f.visibility INTO public_id, visibility;

  RETURN NEXT;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.set_plan_visibility(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_plan_visibility(UUID, TEXT, TEXT) TO authenticated;

-- 3. Admin: the declarations, read only ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_declarations(p_limit INTEGER DEFAULT 200)
RETURNS TABLE (
  id UUID, declared_at TIMESTAMP WITH TIME ZONE, wording_key TEXT, origin_sources TEXT[], user_name TEXT,
  plan_id UUID, public_id TEXT, origin_airport TEXT, destination_airport TEXT, flight_number TEXT, total BIGINT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT d.id, d.declared_at, d.wording_key, d.origin_sources, COALESCE(p.discord_username, 'Infinite Planner admin'),
         f.id, f.public_id, f.origin_airport, f.destination_airport, f.flight_number, count(*) OVER ()
  FROM public.plan_declarations d
  JOIN public.flight_plans f ON f.id = d.plan_id
  JOIN public.profiles p ON p.id = d.user_id
  WHERE (SELECT public.is_admin())
  ORDER BY d.declared_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 200), 1), 500);
$$;
REVOKE EXECUTE ON FUNCTION public.admin_list_declarations(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_declarations(INTEGER) TO authenticated;

-- Rollback: re-create set_plan_visibility(UUID, TEXT) from 20261018000000 and declare_import_rights from
-- 20261018000100; then DROP FUNCTION admin_list_declarations; DROP TABLE plan_declarations (data kept until then).
