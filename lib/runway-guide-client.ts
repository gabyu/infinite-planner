// The editor's side of runway guides: what goes to the database and what comes back. The functions take the signed-in
// Supabase client; the shapes and the error mapping are pure (and tested). The table and its rules:
// supabase/migrations/20261020000000_runway_guides.sql (a guide is private to its owner; the database copies the origin
// from the plan and refuses anything malformed).
import type { SupabaseClient } from "@supabase/supabase-js"
import type { DepartureExtraction, FramePoint } from "@/lib/runway-guide"

export interface StoredGuide {
  id: string
  airport: string
  runwayName: string | null
  runwayHeadingDeg: number | null
  tocBearingDeg: number
  tocDistanceNm: number
  label: string | null
  points: FramePoint[]
  useCount: number
  originSources: string[]
  createdAt: string
}

export type GuideErrorKey = "tooMany" | "notSaved" | "notDraft" | "notFound" | "generic"

const COLUMNS =
  "id, airport, runway_name, runway_heading_deg, toc_bearing_deg, toc_distance_nm, label, points, use_count, origin_sources, created_at"

/** [along, across, altitude] triples as the database stores them (whole metres and feet). */
export function pointsToPayload(points: FramePoint[]): number[][] {
  return points.map((point) => [Math.round(point.along), Math.round(point.across), Math.round(point.altitude)])
}

/** One database row as a guide, or null when it is not shaped like one (never trust a row blindly). */
export function rowToGuide(row: unknown): StoredGuide | null {
  if (!row || typeof row !== "object") return null
  const r = row as Record<string, unknown>
  const triples = r.points
  if (typeof r.id !== "string" || typeof r.airport !== "string" || !Array.isArray(triples) || triples.length < 3) return null
  const points: FramePoint[] = []
  for (const triple of triples) {
    if (!Array.isArray(triple) || triple.length !== 3 || triple.some((value) => typeof value !== "number" || !Number.isFinite(value))) return null
    points.push({ along: triple[0], across: triple[1], altitude: triple[2] })
  }
  return {
    id: r.id,
    airport: r.airport,
    runwayName: typeof r.runway_name === "string" ? r.runway_name : null,
    runwayHeadingDeg: typeof r.runway_heading_deg === "number" ? r.runway_heading_deg : null,
    tocBearingDeg: Number(r.toc_bearing_deg) || 0,
    tocDistanceNm: Number(r.toc_distance_nm) || 0,
    label: typeof r.label === "string" ? r.label : null,
    points,
    useCount: Number(r.use_count) || 0,
    originSources: Array.isArray(r.origin_sources) ? r.origin_sources.filter((s): s is string => typeof s === "string") : [],
    createdAt: typeof r.created_at === "string" ? r.created_at : "",
  }
}

/** Which message to show for an error the database raised (its messages start with a code). */
export function guideErrorKey(message: string | null | undefined): GuideErrorKey {
  const text = message ?? ""
  if (text.includes("too_many_guides")) return "tooMany"
  if (text.includes("plan_not_found")) return "notSaved"
  if (text.includes("plan_not_draft")) return "notDraft"
  if (text.includes("guide_not_found")) return "notFound"
  return "generic"
}

export class GuideError extends Error {
  key: GuideErrorKey
  constructor(message: string | null | undefined) {
    super(message ?? "guide error")
    this.key = guideErrorKey(message)
  }
}

export async function fetchGuides(supabase: SupabaseClient, airport: string): Promise<StoredGuide[]> {
  const { data, error } = await supabase
    .from("runway_guides")
    .select(COLUMNS)
    .eq("kind", "departure")
    .eq("airport", airport)
    .order("created_at", { ascending: false })
    .limit(100)
  if (error) throw new GuideError(error.message)
  return (data ?? []).map(rowToGuide).filter((guide): guide is StoredGuide => guide !== null)
}

export async function saveGuide(supabase: SupabaseClient, planId: string, airport: string, found: DepartureExtraction, label?: string): Promise<string> {
  const { data, error } = await supabase.rpc("save_runway_guide", {
    p_plan_id: planId,
    p_airport: airport,
    p_runway_name: found.runwayEnd ?? "",
    p_runway_heading: found.runwayHeadingTrue,
    p_toc_bearing: found.tocBearing,
    p_toc_distance: found.tocDistanceNm,
    p_points: pointsToPayload(found.points),
    p_label: label ?? null,
  })
  if (error || typeof data !== "string") throw new GuideError(error?.message)
  return data
}

/** Tells the database a guide is used on a plan: the plan takes the guide's origin. Returns the plan's origin set. */
export async function attachGuideToPlan(supabase: SupabaseClient, planId: string, guideId: string): Promise<string[]> {
  const { data, error } = await supabase.rpc("apply_runway_guides", { p_plan_id: planId, p_guide_ids: [guideId] })
  if (error || !Array.isArray(data)) throw new GuideError(error?.message)
  return data.filter((source): source is string => typeof source === "string")
}

export async function deleteGuide(supabase: SupabaseClient, guideId: string): Promise<void> {
  const { error } = await supabase.from("runway_guides").delete().eq("id", guideId)
  if (error) throw new GuideError(error.message)
}
