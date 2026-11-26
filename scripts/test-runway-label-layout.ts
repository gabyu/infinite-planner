// Run with `pnpm test:runway-label-layout`. Plain asserts: the project has no test runner.
import assert from "node:assert/strict"
import { layoutRunwayTags, RUNWAY_TAG, type RunwayTag } from "@/lib/runway-label-layout"

// Where each tag ends up: its threshold plus the shift.
const place = (tags: RunwayTag[]) => {
  const shifts = layoutRunwayTags(tags)
  return Object.fromEntries(tags.map((tag) => [tag.name, { x: tag.x + shifts[tag.name].dx, y: tag.y + shifts[tag.name].dy }]))
}
const overlaps = (at: ReturnType<typeof place>) => {
  const names = Object.keys(at)
  return names.flatMap((a, i) =>
    names
      .slice(i + 1)
      .filter((b) => Math.abs(at[a].x - at[b].x) < RUNWAY_TAG.width && Math.abs(at[a].y - at[b].y) < RUNWAY_TAG.height)
      .map((b) => `${a}/${b}`),
  )
}

// KIAH at zoom 13, north-west corner: 15L and 15R end close together, with 08R just above them (pixels from the airport data).
const kiah: RunwayTag[] = [
  { name: "15L", x: 547, y: 363, headingTrue: 150, rank: 2 },
  { name: "15R", x: 527, y: 363, headingTrue: 150, rank: 2 },
  { name: "08R", x: 564, y: 326, headingTrue: 90, rank: 2 },
]
const at = place(kiah)
// The two parallels sit side by side, touching, in the order of their runways (15R to the west).
assert.equal(at["15L"].y, at["15R"].y)
assert.equal(at["15L"].x - at["15R"].x, RUNWAY_TAG.width)
// The block stays at the end of its runways (just outside them, on their line), not pushed off to one side.
const centre = (at["15L"].x + at["15R"].x) / 2
assert.ok(Math.abs(centre - 529) <= 6, `block centre ${centre}`)
assert.ok(at["15L"].y >= 340 && at["15L"].y <= 356, `block height ${at["15L"].y}`)
// Each tag is the nearer one to its own runway end.
assert.ok(Math.abs(at["15R"].x - 527) < Math.abs(at["15L"].x - 527))
assert.ok(Math.abs(at["15L"].x - 547) < Math.abs(at["15R"].x - 547))
// 08R stays by its own end, and nothing covers anything.
assert.deepEqual(at["08R"], { x: 544, y: 326 })
assert.deepEqual(overlaps(at), [])

// Parallels that end far apart keep their own place.
const apart = place([
  { name: "08L", x: 100, y: 100, headingTrue: 90, rank: 2 },
  { name: "08R", x: 100, y: 200, headingTrue: 90, rank: 2 },
])
assert.deepEqual(apart, { "08L": { x: 80, y: 100 }, "08R": { x: 80, y: 200 } })

// East-west parallels that end close together are stacked, the northern one on top.
const stacked = place([
  { name: "27R", x: 300, y: 100, headingTrue: 270, rank: 2 },
  { name: "27L", x: 300, y: 112, headingTrue: 270, rank: 2 },
])
assert.equal(stacked["27R"].x, stacked["27L"].x)
assert.equal(stacked["27L"].y - stacked["27R"].y, RUNWAY_TAG.height)

console.log("runway-label-layout: all tests passed")
