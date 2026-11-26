// Where the runway-number tags of the editor map go, in pixels at the current zoom. Pure, no React, no Leaflet.
//
// A tag sits just outside its end of the runway, on the runway's own line. Parallel runways that end close together
// (15L and 15R) are placed as one block, side by side in the order of the runways, so that no other tag comes between
// them. A tag or block with no room takes the free place nearest to its own end, moving along the runway's line rather
// than off to one side.

export interface RunwayTag {
  name: string
  /** The threshold, in pixels. */
  x: number
  y: number
  headingTrue: number
  /** Lower is placed first, and so stays closest to its end: chosen, then coloured, then grey. */
  rank: number
}

/** The room one tag takes. */
export const RUNWAY_TAG = { width: 38, height: 24 }
const OFFSET_PX = 20
/** Parallel ends no further apart than this form one block. */
const GROUP_PX = 70
// How far a tag may move to find room, how finely, and what each direction costs: along the runway's line is best
// (away from the runway before over it), sideways last, since a tag off its line reads as another runway's.
const SEARCH_PX = 90
const SEARCH_STEP_PX = 2
const COST = { out: 1, in: 1.5, side: 3 }

const number = (name: string) => name.replace(/[LCR]$/, "")

interface Box {
  x: number
  y: number
  width: number
  height: number
}
const collide = (a: Box, b: Box) => Math.abs(a.x - b.x) < (a.width + b.width) / 2 && Math.abs(a.y - b.y) < (a.height + b.height) / 2

/** How far each tag is drawn from its threshold, by runway name. */
export function layoutRunwayTags(tags: RunwayTag[]): Record<string, { dx: number; dy: number }> {
  const groups: RunwayTag[][] = []
  for (const tag of tags) {
    const group = groups.find((members) =>
      members.some((other) => number(other.name) === number(tag.name) && Math.hypot(other.x - tag.x, other.y - tag.y) <= GROUP_PX),
    )
    if (group) group.push(tag)
    else groups.push([tag])
  }

  const rank = (group: RunwayTag[]) => Math.min(...group.map((tag) => tag.rank))
  const taken: Box[] = []
  const shifts: Record<string, { dx: number; dy: number }> = {}
  // Single tags before blocks of the same rank: a block has more reason to move than one tag.
  for (const group of [...groups].sort((a, b) => rank(a) - rank(b) || a.length - b.length)) {
    const heading = (group[0].headingTrue * Math.PI) / 180
    // Runways heading mostly north or south lie west and east of each other: their tags go in a row. Others stack.
    const inRow = Math.abs(Math.cos(heading)) >= Math.SQRT1_2
    const members = [...group].sort((a, b) => (inRow ? a.x - b.x : a.y - b.y))
    const width = inRow ? RUNWAY_TAG.width * members.length : RUNWAY_TAG.width
    const height = inRow ? RUNWAY_TAG.height : RUNWAY_TAG.height * members.length
    const middle = {
      x: members.reduce((sum, tag) => sum + tag.x, 0) / members.length,
      y: members.reduce((sum, tag) => sum + tag.y, 0) / members.length,
    }
    // Unit vectors on screen: away from the runway, and across it.
    const out = { x: -Math.sin(heading), y: Math.cos(heading) }
    const across = { x: Math.cos(heading), y: Math.sin(heading) }
    const ideal = { x: middle.x + out.x * OFFSET_PX, y: middle.y + out.y * OFFSET_PX }
    const at = (dx: number, dy: number): Box => ({ x: Math.round(ideal.x + dx), y: Math.round(ideal.y + dy), width, height })
    const free = (box: Box) => !taken.some((other) => collide(box, other))
    // The cheapest free place; with none, the ideal one.
    let box = at(0, 0)
    if (!free(box)) {
      let best = Infinity
      for (let dx = -SEARCH_PX; dx <= SEARCH_PX; dx += SEARCH_STEP_PX) {
        for (let dy = -SEARCH_PX; dy <= SEARCH_PX; dy += SEARCH_STEP_PX) {
          const along = dx * out.x + dy * out.y
          const cost = (along >= 0 ? along * COST.out : -along * COST.in) + Math.abs(dx * across.x + dy * across.y) * COST.side
          if (cost >= best) continue
          const candidate = at(dx, dy)
          if (free(candidate)) {
            best = cost
            box = candidate
          }
        }
      }
    }
    taken.push(box)
    members.forEach((tag, index) => {
      const slot = index - (members.length - 1) / 2
      const x = box.x + (inRow ? slot * RUNWAY_TAG.width : 0)
      const y = box.y + (inRow ? 0 : slot * RUNWAY_TAG.height)
      shifts[tag.name] = { dx: Math.round(x - tag.x), dy: Math.round(y - tag.y) }
    })
  }
  return shifts
}
