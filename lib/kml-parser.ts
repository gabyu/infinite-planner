import { DOMParser } from "xmldom"
import { parseFlightFilename, saveFlightData } from "./flight-stats-service"

interface Waypoint {
  id: string
  name: string
  lat: number
  lng: number
  altitude: number
  selected?: boolean
}

interface SimplificationResult {
  waypoints: Waypoint[]
  originalCount: number
  simplifiedCount: number
  simplificationReason: string
  source?: string
}

// Conversion factor from meters to feet
const METERS_TO_FEET = 3.28084

// Minimum distance between airborne waypoints in nautical miles
const MIN_AIRBORNE_DISTANCE_NM = 0.5

// Altitude threshold to consider a waypoint as "on ground" (in feet)
const GROUND_ALTITUDE_THRESHOLD = 1000

export function parseKML(
  kmlString: string,
  filename?: string,
  originAirport?: string,
  destinationAirport?: string,
): SimplificationResult {
  try {
    const parser = new DOMParser()
    const xmlDoc = parser.parseFromString(kmlString, "text/xml")

    const originalWaypoints: Waypoint[] = []
    let source = "Unknown"

    // Detect source
    const gxTracks = xmlDoc.getElementsByTagNameNS("http://www.google.com/kml/ext/2.2", "Track")
    const lineStrings = xmlDoc.getElementsByTagName("LineString")
    const docNames = xmlDoc.getElementsByTagName("name")
    const docName = docNames?.[0]?.textContent || ""

    if (gxTracks?.length > 0 || docName.includes("FlightAware")) {
      source = "FlightAware"
      parseFlightAwareFormat(gxTracks, originalWaypoints)
    } else {
      source = "FlightRadar24"
    }

    // Parse standard KML if no waypoints found
    if (originalWaypoints.length === 0) {
      parseStandardKML(xmlDoc, originalWaypoints)
    }

    if (originalWaypoints.length === 0) {
      console.error("No valid waypoints found in KML file")
      return {
        waypoints: [],
        originalCount: 0,
        simplifiedCount: 0,
        simplificationReason: "No valid waypoints found in KML file",
        source,
      }
    }

    // Save flight statistics
    if (filename && originalWaypoints.length > 0) {
      try {
        const flightData = parseFlightFilename(filename)
        flightData.source = source
        saveFlightData(flightData, originAirport, destinationAirport).catch((error) => {
          console.error("Failed to save flight statistics:", error)
        })
      } catch (error) {
        console.error("Error parsing flight filename:", error)
      }
    }

    // Clean and simplify
    const cleanedWaypoints = removeExactDuplicates(originalWaypoints)
    const result = simplifyFlightPlan(cleanedWaypoints)
    result.source = source

    return result
  } catch (error) {
    console.error("Error parsing KML:", error)
    return {
      waypoints: [],
      originalCount: 0,
      simplifiedCount: 0,
      simplificationReason: `Error parsing KML file: ${error instanceof Error ? error.message : String(error)}`,
      source: "Unknown",
    }
  }
}

// Parse FlightAware format
function parseFlightAwareFormat(gxTracks: any, waypoints: Waypoint[]) {
  for (let i = 0; i < gxTracks.length; i++) {
    const track = gxTracks[i]
    if (!track) continue

    const gxCoords = track.getElementsByTagNameNS("http://www.google.com/kml/ext/2.2", "coord")
    if (!gxCoords?.length) continue

    for (let j = 0; j < gxCoords.length; j++) {
      const coordText = gxCoords[j].textContent?.trim()
      if (!coordText) continue

      const parts = coordText.split(/\s+/)
      if (parts.length < 2) continue

      const lng = Number.parseFloat(parts[0])
      const lat = Number.parseFloat(parts[1])
      const altitudeMeters = parts.length >= 3 ? Number.parseFloat(parts[2]) : 0
      const altitudeFeet = Math.round(altitudeMeters * METERS_TO_FEET)

      if (!isNaN(lat) && !isNaN(lng)) {
        waypoints.push({
          id: `${Date.now()}-fa-${i}-${j}`,
          name: String(waypoints.length + 1).padStart(3, "0"),
          lat,
          lng,
          altitude: altitudeFeet,
          selected: false,
        })
      }
    }
  }
}

// Parse standard KML format
function parseStandardKML(xmlDoc: Document, waypoints: Waypoint[]) {
  const allCoordinatesElements = xmlDoc.getElementsByTagName("coordinates")

  for (let i = 0; i < allCoordinatesElements.length; i++) {
    const coordinatesText = allCoordinatesElements[i].textContent?.trim()
    if (!coordinatesText) continue

    const coordLines = coordinatesText.split(/\s+/)

    for (let j = 0; j < coordLines.length; j++) {
      const coordLine = coordLines[j].trim()
      if (!coordLine) continue

      const parts = coordLine.split(",")
      if (parts.length < 2) continue

      const lng = Number.parseFloat(parts[0])
      const lat = Number.parseFloat(parts[1])
      const altitudeMeters = parts.length >= 3 ? Number.parseFloat(parts[2]) : 0
      const altitudeFeet = Math.round(altitudeMeters * METERS_TO_FEET)

      if (!isNaN(lat) && !isNaN(lng)) {
        waypoints.push({
          id: `${Date.now()}-std-${i}-${j}`,
          name: String(waypoints.length + 1).padStart(3, "0"),
          lat,
          lng,
          altitude: altitudeFeet,
          selected: false,
        })
      }
    }
  }
}

// Remove exact duplicate waypoints
function removeExactDuplicates(waypoints: Waypoint[]): Waypoint[] {
  const unique: Waypoint[] = []
  const seen = new Set<string>()

  for (const wp of waypoints) {
    const key = `${wp.lat.toFixed(6)},${wp.lng.toFixed(6)}`
    if (!seen.has(key)) {
      seen.add(key)
      unique.push(wp)
    }
  }

  return unique
}

// Calculate distance between two points in nautical miles
function calculateDistanceNM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3440.065 // Earth's radius in nautical miles
  const dLat = toRadians(lat2 - lat1)
  const dLon = toRadians(lon2 - lon1)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180)
}

// Check if waypoint is on ground
function isOnGround(waypoint: Waypoint): boolean {
  return waypoint.altitude < GROUND_ALTITUDE_THRESHOLD
}

// Calculate turn angle at a waypoint (in radians)
function calculateTurnAngle(prev: Waypoint, curr: Waypoint, next: Waypoint): number {
  const angle1 = Math.atan2(curr.lat - prev.lat, curr.lng - prev.lng)
  const angle2 = Math.atan2(next.lat - curr.lat, next.lng - curr.lng)
  let turnAngle = Math.abs(angle2 - angle1)

  if (turnAngle > Math.PI) {
    turnAngle = 2 * Math.PI - turnAngle
  }

  return turnAngle
}

// Calculate importance score for a waypoint
function calculateImportance(prev: Waypoint, curr: Waypoint, next: Waypoint, index: number, total: number): number {
  // Always keep first and last waypoints
  if (index === 0 || index === total - 1) {
    return Number.MAX_VALUE
  }

  let score = 0

  // Turn angle (0 to π) - normalized to 0-1
  const turnAngle = calculateTurnAngle(prev, curr, next)
  score += turnAngle / Math.PI

  // Altitude change - normalized
  const altChange = Math.abs(next.altitude - prev.altitude)
  score += altChange / 10000

  // Distance to next point - prefer points that are well-spaced
  const distance = calculateDistanceNM(curr.lat, curr.lng, next.lat, next.lng)
  score += Math.min(distance / 10, 0.5) // Cap distance bonus

  // Ground operations bonus - keep more ground waypoints
  if (isOnGround(curr)) {
    score += 2.0
  }

  return score
}

// Main simplification function
function simplifyFlightPlan(waypoints: Waypoint[]): SimplificationResult {
  const originalCount = waypoints.length

  if (originalCount <= 248) {
    return {
      waypoints: waypoints.map((wp, i) => ({ ...wp, name: String(i + 1).padStart(3, "0") })),
      originalCount,
      simplifiedCount: originalCount,
      simplificationReason: "No simplification needed (fewer than 248 waypoints)",
    }
  }

  try {
    // Step 1: Identify flight phases
    const phases = identifyFlightPhases(waypoints)

    // Step 2: Score each waypoint by importance
    const scoredWaypoints = waypoints.map((wp, index, arr) => {
      if (index === 0 || index === arr.length - 1) {
        return { waypoint: wp, score: Number.MAX_VALUE, index }
      }

      const prev = arr[index - 1]
      const next = arr[index + 1]
      const score = calculateImportance(prev, wp, next, index, arr.length)

      return { waypoint: wp, score, index }
    })

    // Step 3: Select waypoints based on score and phase
    const targetCount = 245 // Leave small buffer
    const selected = selectWaypointsByImportance(scoredWaypoints, phases, targetCount)

    // Step 4: Enforce minimum distance between airborne waypoints
    const filtered = enforceMinimumDistance(selected)

    // Step 5: Final check - if still over limit, trim by importance
    let final = filtered
    if (final.length > 248) {
      final = trimToLimit(final, 248)
    }

    // Rename waypoints sequentially
    const renamedWaypoints = final.map((wp, index) => ({
      ...wp,
      name: String(index + 1).padStart(3, "0"),
    }))

    const simplificationReason = `Simplified from ${originalCount} to ${renamedWaypoints.length} waypoints using importance-based selection with minimum distance enforcement`

    return {
      waypoints: renamedWaypoints,
      originalCount,
      simplifiedCount: renamedWaypoints.length,
      simplificationReason,
    }
  } catch (error) {
    console.error("Error during simplification:", error)

    // Fallback: evenly spaced selection
    const step = Math.floor(originalCount / 245)
    const fallback = waypoints.filter((_, i) => i === 0 || i === originalCount - 1 || i % step === 0)

    return {
      waypoints: fallback.map((wp, i) => ({ ...wp, name: String(i + 1).padStart(3, "0") })),
      originalCount,
      simplifiedCount: fallback.length,
      simplificationReason: `Fallback simplification from ${originalCount} to ${fallback.length} waypoints`,
    }
  }
}

// Identify flight phases based on altitude
interface FlightPhase {
  start: number
  end: number
  type: "ground" | "climb" | "cruise" | "descent"
}

function identifyFlightPhases(waypoints: Waypoint[]): FlightPhase[] {
  const phases: FlightPhase[] = []
  let currentPhase: FlightPhase | null = null

  // Find max altitude to determine cruise phase
  const maxAltitude = Math.max(...waypoints.map((wp) => wp.altitude))
  const cruiseAltitude = maxAltitude * 0.9 // Consider 90% of max as cruise

  for (let i = 0; i < waypoints.length; i++) {
    const wp = waypoints[i]
    let phaseType: FlightPhase["type"]

    if (wp.altitude < GROUND_ALTITUDE_THRESHOLD) {
      phaseType = "ground"
    } else if (wp.altitude >= cruiseAltitude) {
      phaseType = "cruise"
    } else {
      // Check if climbing or descending
      const nextAlt = i < waypoints.length - 1 ? waypoints[i + 1].altitude : wp.altitude
      phaseType = nextAlt > wp.altitude ? "climb" : "descent"
    }

    if (!currentPhase || currentPhase.type !== phaseType) {
      if (currentPhase) {
        currentPhase.end = i - 1
        phases.push(currentPhase)
      }
      currentPhase = { start: i, end: i, type: phaseType }
    }
  }

  if (currentPhase) {
    currentPhase.end = waypoints.length - 1
    phases.push(currentPhase)
  }

  return phases
}

// Select waypoints by importance with phase-aware allocation
function selectWaypointsByImportance(
  scoredWaypoints: Array<{ waypoint: Waypoint; score: number; index: number }>,
  phases: FlightPhase[],
  targetCount: number,
): Waypoint[] {
  // Allocate waypoints per phase
  const allocation = new Map<string, number>()
  const totalWaypoints = scoredWaypoints.length

  for (const phase of phases) {
    const phaseLength = phase.end - phase.start + 1
    const phaseRatio = phaseLength / totalWaypoints

    let phaseTarget: number
    if (phase.type === "ground") {
      // Keep 50% of ground waypoints for both departure and arrival taxi
      phaseTarget = Math.ceil(phaseLength * 0.5)
    } else if (phase.type === "descent") {
      // Allocate MORE for descent - 70% more than proportional to capture entire approach
      phaseTarget = Math.ceil(phaseRatio * targetCount * 1.7)
    } else if (phase.type === "climb") {
      // Allocate 30% more for climb
      phaseTarget = Math.ceil(phaseRatio * targetCount * 1.3)
    } else {
      // Cruise can be simplified more (20% less)
      phaseTarget = Math.floor(phaseRatio * targetCount * 0.8)
    }

    allocation.set(`${phase.start}-${phase.end}`, phaseTarget)
  }

  // Select waypoints
  const selected: Waypoint[] = []
  const selectedIndices = new Set<number>()

  // Always include first and last
  selected.push(scoredWaypoints[0].waypoint)
  selectedIndices.add(0)
  selected.push(scoredWaypoints[scoredWaypoints.length - 1].waypoint)
  selectedIndices.add(scoredWaypoints.length - 1)

  // Select from each phase
  for (const phase of phases) {
    const phaseWaypoints = scoredWaypoints.slice(phase.start, phase.end + 1)
    const phaseTarget = allocation.get(`${phase.start}-${phase.end}`) || 0

    // Different selection strategy for each phase type
    if (phase.type === "ground") {
      // For ground waypoints, use evenly spaced selection for cleaner reduction
      const step = Math.max(2, Math.ceil(phaseWaypoints.length / phaseTarget))
      let count = 0

      for (let i = 0; i < phaseWaypoints.length && count < phaseTarget; i += step) {
        if (!selectedIndices.has(phaseWaypoints[i].index)) {
          selected.push(phaseWaypoints[i].waypoint)
          selectedIndices.add(phaseWaypoints[i].index)
          count++
        }
      }
    } else if (phase.type === "descent") {
      // For descent, use altitude-based even distribution to avoid gaps
      // Split into two altitude bands for better distribution
      const above10k = phaseWaypoints.filter((wp) => wp.waypoint.altitude >= 10000)
      const below10k = phaseWaypoints.filter((wp) => wp.waypoint.altitude < 10000)

      // Allocate 40% to above 10k, 60% to below 10k (approach is more critical)
      const above10kTarget = Math.ceil(phaseTarget * 0.4)
      const below10kTarget = Math.ceil(phaseTarget * 0.6)

      // Select evenly from above 10k
      if (above10k.length > 0) {
        const step = Math.max(1, Math.floor(above10k.length / above10kTarget))
        for (let i = 0; i < above10k.length; i += step) {
          if (!selectedIndices.has(above10k[i].index)) {
            selected.push(above10k[i].waypoint)
            selectedIndices.add(above10k[i].index)
          }
        }
      }

      // Select evenly from below 10k
      if (below10k.length > 0) {
        const step = Math.max(1, Math.floor(below10k.length / below10kTarget))
        for (let i = 0; i < below10k.length; i += step) {
          if (!selectedIndices.has(below10k[i].index)) {
            selected.push(below10k[i].waypoint)
            selectedIndices.add(below10k[i].index)
          }
        }
      }
    } else {
      // For climb and cruise, use importance-based selection
      const sorted = phaseWaypoints.sort((a, b) => b.score - a.score)
      const toTake = Math.min(phaseTarget, sorted.length)

      for (let i = 0; i < toTake; i++) {
        if (!selectedIndices.has(sorted[i].index)) {
          selected.push(sorted[i].waypoint)
          selectedIndices.add(sorted[i].index)
        }
      }
    }
  }

  // Sort by original order
  return selected.sort((a, b) => {
    const indexA = scoredWaypoints.findIndex((sw) => sw.waypoint.id === a.id)
    const indexB = scoredWaypoints.findIndex((sw) => sw.waypoint.id === b.id)
    return indexA - indexB
  })
}

// Enforce minimum distance between airborne waypoints
function enforceMinimumDistance(waypoints: Waypoint[]): Waypoint[] {
  if (waypoints.length <= 2) return waypoints

  const filtered: Waypoint[] = [waypoints[0]] // Always keep first

  for (let i = 1; i < waypoints.length - 1; i++) {
    const prev = filtered[filtered.length - 1]
    const curr = waypoints[i]

    // If on ground, always keep
    if (isOnGround(curr) || isOnGround(prev)) {
      filtered.push(curr)
      continue
    }

    // Check altitude change - if significant, ALWAYS keep regardless of horizontal distance
    const altChange = Math.abs(curr.altitude - prev.altitude)
    if (altChange > 1000) {
      // More than 1000ft altitude change
      filtered.push(curr)
      continue
    }

    // Only check horizontal distance if altitude change is small
    const distance = calculateDistanceNM(prev.lat, prev.lng, curr.lat, curr.lng)

    if (distance >= MIN_AIRBORNE_DISTANCE_NM) {
      filtered.push(curr)
    }
    // Otherwise skip this waypoint
  }

  // Always keep last
  filtered.push(waypoints[waypoints.length - 1])

  return filtered
}

// Trim to exact limit by removing lowest importance waypoints
function trimToLimit(waypoints: Waypoint[], limit: number): Waypoint[] {
  if (waypoints.length <= limit) return waypoints

  // Calculate importance for each waypoint
  const scored = waypoints.map((wp, index, arr) => {
    if (index === 0 || index === arr.length - 1) {
      return { waypoint: wp, score: Number.MAX_VALUE }
    }

    const prev = arr[index - 1]
    const next = arr[index + 1]
    const score = calculateImportance(prev, wp, next, index, arr.length)

    return { waypoint: wp, score }
  })

  // Sort by score (descending) and take top N
  const sorted = scored.sort((a, b) => b.score - a.score)
  const selected = sorted.slice(0, limit)

  // Re-sort by original order
  return selected
    .sort((a, b) => {
      const indexA = waypoints.indexOf(a.waypoint)
      const indexB = waypoints.indexOf(b.waypoint)
      return indexA - indexB
    })
    .map((item) => item.waypoint)
}
