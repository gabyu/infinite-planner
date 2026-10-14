import { LAND_BITMAP, LAND_HEIGHT, LAND_WIDTH } from "@/lib/data/globe-land"

// Land / water at a point, from the same 0.5 degree bitmap the homepage globe is drawn with
// (so the globe, the visualizer and the plan page's map agree on the coastlines).
let bits: Uint8Array | null = null

export function isLand(lat: number, lng: number): boolean {
  if (!bits) bits = Uint8Array.from(atob(LAND_BITMAP), (c) => c.charCodeAt(0))
  if (lat > 90 || lat < -90) return false
  const wrapped = ((((lng + 180) % 360) + 360) % 360) - 180
  const x = Math.min(LAND_WIDTH - 1, Math.floor(((wrapped + 180) / 360) * LAND_WIDTH))
  const y = Math.min(LAND_HEIGHT - 1, Math.floor(((90 - lat) / 180) * LAND_HEIGHT))
  const i = y * LAND_WIDTH + x
  return (bits[i >> 3] & (1 << (i & 7))) !== 0
}
