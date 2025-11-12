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

interface SimplificationAttempt {
  waypoints: Waypoint[]
  count: number
  score: number // How close to target (230)
  attempt: number
  minDistance: number
  importanceThreshold: number
}

// Conversion factor from meters to feet
const METERS_TO_FEET = 3.28084

// Minimum distance between airborne waypoints in nautical miles
const MIN_AIRBORNE_DISTANCE_NM = 0.5

// Altitude threshold to consider a waypoint as "on ground" (in feet)
const GROUND_ALTITUDE_THRESHOLD = 1000

// Base density: ~1 waypoint per 6 NM for turns
const TURN_WAYPOINT_DENSITY = 0.15

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

function calculateImportance(prev: Waypoint, curr: Waypoint, next: Waypoint, index: number, total: number): number {
  // Always keep first and last waypoints
  if (index === 0 || index === total - 1) {
    return Number.MAX_VALUE
  }

  let score = 0

  // Turn angle (0 to π) - highly weighted for capturing turns
  const turnAngle = calculateTurnAngle(prev, curr, next)
  const turnAngleNormalized = turnAngle / Math.PI // 0 to 1

  // Significant turns (>15 degrees) get exponential boost
  if (turnAngleNormalized > 0.083) {
    // ~15 degrees
    score += Math.pow(turnAngleNormalized, 0.8) * 3.0
  } else {
    score += turnAngleNormalized
  }

  // Altitude change - highly important for descent/climb visualization
  const altChange = Math.abs(next.altitude - prev.altitude)
  score += Math.min(altChange / 5000, 2.0) // Normalized altitude change

  // Distance to next point - prefer well-distributed waypoints
  const distance = calculateDistanceNM(curr.lat, curr.lng, next.lat, next.lng)
  score += Math.min(distance / 5, 1.0) // Cap distance bonus

  // Ground operations bonus
  if (isOnGround(curr)) {
    score += 1.5
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
    const attempts: SimplificationAttempt[] = []
    const target = 230
    const minTarget = 220
    const maxTarget = 240

    // Attempt 1: Standard parameters
    attempts.push(attemptSimplification(waypoints, 1, 0.5, 0.1))

    // Attempt 2: More lenient (lower min distance)
    attempts.push(attemptSimplification(waypoints, 2, 0.35, 0.08))

    // Attempt 3: Most lenient (even lower min distance)
    attempts.push(attemptSimplification(waypoints, 3, 0.2, 0.05))

    // Attempt 4: Aggressive phase allocation (more waypoints to critical phases)
    attempts.push(attemptSimplification(waypoints, 4, 0.3, 0.06))

    // Select best attempt (closest to target in range)
    let bestAttempt = attempts[0]
    let bestScore = Number.MAX_VALUE

    for (const attempt of attempts) {
      let score: number

      if (attempt.count >= minTarget && attempt.count <= maxTarget) {
        // Perfect range - score by distance from exact target
        score = Math.abs(attempt.count - target)
      } else if (attempt.count < minTarget) {
        // Below range - penalize heavily (2x multiplier)
        score = (minTarget - attempt.count) * 2
      } else {
        // Above range - penalize moderately
        score = (attempt.count - maxTarget) * 1.5
      }

      console.log(`[v0] Attempt ${attempt.attempt}: ${attempt.count} waypoints (score: ${score.toFixed(2)})`)

      if (score < bestScore) {
        bestScore = score
        bestAttempt = attempt
      }
    }

    console.log(`[v0] Selected attempt ${bestAttempt.attempt} with ${bestAttempt.count} waypoints`)

    // Rename waypoints sequentially
    const renamedWaypoints = bestAttempt.waypoints.map((wp, index) => ({
      ...wp,
      name: String(index + 1).padStart(3, "0"),
    }))

    const simplificationReason = `Simplified from ${originalCount} to ${renamedWaypoints.length} waypoints using multi-attempt importance-based selection`

    return {
      waypoints: renamedWaypoints,
      originalCount,
      simplifiedCount: renamedWaypoints.length,
      simplificationReason,
    }
  } catch (error) {
    console.error("Error during simplification:", error)

    // Fallback: evenly spaced selection
    const step = Math.floor(originalCount / 230)
    const fallback = waypoints.filter((_, i) => i === 0 || i === originalCount - 1 || i % step === 0)

    return {
      waypoints: fallback.map((wp, i) => ({ ...wp, name: String(i + 1).padStart(3, "0") })),
      originalCount,
      simplifiedCount: fallback.length,
      simplificationReason: `Fallback simplification from ${originalCount} to ${fallback.length} waypoints`,
    }
  }
}

function attemptSimplification(
  waypoints: Waypoint[],
  attemptNumber: number,
  minDistanceMultiplier: number,
  importanceThreshold: number,
): SimplificationAttempt {
  // Identify phases
  const phases = identifyFlightPhases(waypoints)

  // Score waypoints
  const scoredWaypoints = waypoints.map((wp, index, arr) => {
    if (index === 0 || index === arr.length - 1) {
      return { waypoint: wp, score: Number.MAX_VALUE, index }
    }

    const prev = arr[index - 1]
    const next = arr[index + 1]
    const score = calculateImportance(prev, wp, next, index, arr.length)

    return { waypoint: wp, score, index }
  })

  // Select waypoints - aim for 235 to give buffer
  const targetCount = 235
  const selected = selectWaypointsByImportance(scoredWaypoints, phases, targetCount)

  // Enforce minimum distance with custom multiplier
  const filtered = enforceMinimumDistanceWithParams(selected, minDistanceMultiplier, importanceThreshold)

  // Trim if needed
  let final = filtered
  if (final.length > 248) {
    final = trimToLimit(final, 248)
  }

  return {
    waypoints: final,
    count: final.length,
    score: 0, // Calculated in caller
    attempt: attemptNumber,
    minDistance: minDistanceMultiplier,
    importanceThreshold: importanceThreshold,
  }
}

function enforceMinimumDistanceWithParams(
  waypoints: Waypoint[],
  minDistanceMultiplier: number,
  importanceThreshold: number,
): Waypoint[] {
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

    // Base leg zone: more lenient
    const isBaseLegZone = curr.altitude >= 3000 && curr.altitude <= 6000
    const minDistance = isBaseLegZone ? 0.2 * minDistanceMultiplier : 0.5 * minDistanceMultiplier

    // Check altitude change
    const altChange = Math.abs(curr.altitude - prev.altitude)
    const minAltChange = isBaseLegZone ? 150 : 800

    if (altChange > minAltChange) {
      filtered.push(curr)
      continue
    }

    // Check distance
    const distance = calculateDistanceNM(prev.lat, prev.lng, curr.lat, curr.lng)
    if (distance >= minDistance) {
      filtered.push(curr)
    }
  }

  filtered.push(waypoints[waypoints.length - 1])
  return filtered
}

// Identify flight phases based on altitude
interface FlightPhase {
  start: number
  end: number
  type: "ground" | "initial_climb" | "climb" | "cruise" | "descent" | "approach" | "final"
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
      const isClimbing = nextAlt > wp.altitude

      if (isClimbing) {
        // Split climb into initial (below 10k) and high altitude
        phaseType = wp.altitude < 10000 ? "initial_climb" : "climb"
      } else {
        // Split descent into high altitude, approach, and final
        if (wp.altitude >= 12000) {
          phaseType = "descent"
        } else if (wp.altitude >= 3000) {
          phaseType = "approach"
        } else {
          phaseType = "final"
        }
      }
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
      phaseTarget = Math.ceil(phaseLength * 0.27)
    } else if (phase.type === "initial_climb") {
      phaseTarget = Math.ceil(phaseLength * 0.3)
    } else if (phase.type === "climb") {
      phaseTarget = Math.ceil(phaseRatio * targetCount * 0.8)
    } else if (phase.type === "descent") {
      phaseTarget = Math.ceil(phaseLength * 0.18)
    } else if (phase.type === "approach") {
      phaseTarget = Math.ceil(phaseLength * 0.55)
    } else if (phase.type === "final") {
      phaseTarget = Math.ceil(phaseLength * 0.75)
    } else if (phase.type === "cruise") {
      phaseTarget = calculateCruiseWaypoints(scoredWaypoints, phase)
    } else {
      phaseTarget = Math.floor(phaseRatio * targetCount * 0.6)
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

    if (phase.type === "ground") {
      // Ground: Keep first waypoint (pushback location)
      // and select runway turns by importance
      selectGroundWaypoints(phaseWaypoints, phaseTarget, selected, selectedIndices)
    } else if (phase.type === "cruise") {
      selectCruiseWaypoints(phaseWaypoints, selected, selectedIndices)
    } else if (
      phase.type === "initial_climb" ||
      phase.type === "final" ||
      phase.type === "approach" ||
      phase.type === "descent"
    ) {
      // This ensures we get 3-4 waypoints for 90° turns and 5-6 for 180° turns
      const sorted = phaseWaypoints.sort((a, b) => b.score - a.score)
      const toTake = Math.min(phaseTarget, sorted.length)

      for (let i = 0; i < toTake; i++) {
        if (!selectedIndices.has(sorted[i].index)) {
          selected.push(sorted[i].waypoint)
          selectedIndices.add(sorted[i].index)
        }
      }
    } else {
      // Climb and other phases - use importance-based selection
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

function calculateCruiseWaypoints(
  scoredWaypoints: Array<{ waypoint: Waypoint; score: number; index: number }>,
  phase: FlightPhase,
): number {
  const cruiseWaypoints = scoredWaypoints.slice(phase.start, phase.end + 1)
  if (cruiseWaypoints.length <= 1) return 0

  let totalDistance = 0
  for (let i = 0; i < cruiseWaypoints.length - 1; i++) {
    const current = cruiseWaypoints[i].waypoint
    const next = cruiseWaypoints[i + 1].waypoint
    totalDistance += calculateDistanceNM(current.lat, current.lng, next.lat, next.lng)
  }

  // Aim for 1 waypoint every 50 NM
  const targetSpacing = 50
  const waypointsNeeded = Math.max(2, Math.ceil(totalDistance / targetSpacing))
  return waypointsNeeded
}

function selectCruiseWaypoints(
  phaseWaypoints: Array<{ waypoint: Waypoint; score: number; index: number }>,
  selected: Waypoint[],
  selectedIndices: Set<number>,
): void {
  if (phaseWaypoints.length <= 2) {
    // If very few waypoints, take them all
    for (const item of phaseWaypoints) {
      if (!selectedIndices.has(item.index)) {
        selected.push(item.waypoint)
        selectedIndices.add(item.index)
      }
    }
    return
  }

  // Always take first waypoint
  if (!selectedIndices.has(phaseWaypoints[0].index)) {
    selected.push(phaseWaypoints[0].waypoint)
    selectedIndices.add(phaseWaypoints[0].index)
  }

  // Calculate cumulative distances for even spacing
  const waypoints = phaseWaypoints.map((item) => item.waypoint)
  const distances: number[] = [0]

  for (let i = 1; i < waypoints.length; i++) {
    const distance =
      distances[i - 1] +
      calculateDistanceNM(waypoints[i - 1].lat, waypoints[i - 1].lng, waypoints[i].lat, waypoints[i].lng)
    distances.push(distance)
  }

  const totalDistance = distances[distances.length - 1]
  if (totalDistance === 0) return

  // Target 1 waypoint every 50 NM
  const targetSpacing = 50
  const numWaypoints = Math.max(2, Math.ceil(totalDistance / targetSpacing))
  const step = totalDistance / (numWaypoints - 1)

  // Select waypoints at regular distance intervals
  for (let i = 1; i < numWaypoints - 1; i++) {
    const targetDistance = step * i
    let closestIndex = 0
    let closestDiff = Math.abs(distances[0] - targetDistance)

    // Find waypoint closest to target distance
    for (let j = 1; j < distances.length; j++) {
      const diff = Math.abs(distances[j] - targetDistance)
      if (diff < closestDiff) {
        closestDiff = diff
        closestIndex = j
      }
    }

    const waypoint = phaseWaypoints[closestIndex]
    if (!selectedIndices.has(waypoint.index)) {
      selected.push(waypoint.waypoint)
      selectedIndices.add(waypoint.index)
    }
  }

  // Always take last waypoint
  const lastItem = phaseWaypoints[phaseWaypoints.length - 1]
  if (!selectedIndices.has(lastItem.index)) {
    selected.push(lastItem.waypoint)
    selectedIndices.add(lastItem.index)
  }
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

// Select ground waypoints by importance
function selectGroundWaypoints(
  phaseWaypoints: Array<{ waypoint: Waypoint; score: number; index: number }>,
  phaseTarget: number,
  selected: Waypoint[],
  selectedIndices: Set<number>,
): void {
  if (phaseWaypoints.length === 0) return

  // Always keep first waypoint (pushback location)
  if (!selectedIndices.has(phaseWaypoints[0].index)) {
    selected.push(phaseWaypoints[0].waypoint)
    selectedIndices.add(phaseWaypoints[0].index)
  }

  // For remaining waypoints, select by importance to capture runway turns
  const remaining = phaseWaypoints.slice(1)
  const sorted = remaining.sort((a, b) => b.score - a.score)
  const toTake = Math.max(0, phaseTarget - 1) // -1 because we already kept first

  for (let i = 0; i < Math.min(toTake, sorted.length); i++) {
    if (!selectedIndices.has(sorted[i].index)) {
      selected.push(sorted[i].waypoint)
      selectedIndices.add(sorted[i].index)
    }
  }
}
