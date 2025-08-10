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
  source?: string // Added to track the source of the KML file
}

// Conversion factor from meters to feet (1 meter = 3.28084 feet)
const METERS_TO_FEET = 3.28084

export function parseKML(
  kmlString: string,
  filename?: string,
  originAirport?: string,
  destinationAirport?: string,
): SimplificationResult {
  try {
    const parser = new DOMParser()
    const xmlDoc = parser.parseFromString(kmlString, "text/xml")

    // Initialize waypoints array
    const originalWaypoints: Waypoint[] = []

    // Detect the source of the KML file (FlightRadar24 or FlightAware)
    let source = "Unknown"

    // Check for FlightAware signature (gx:Track elements with gx:coord)
    const gxTracks = xmlDoc.getElementsByTagNameNS("http://www.google.com/kml/ext/2.2", "Track")
    const hasFlightAwareSignature = gxTracks && gxTracks.length > 0

    // Check for FlightRadar24 signature (typically has LineString with coordinates)
    const lineStrings = xmlDoc.getElementsByTagName("LineString")
    const hasFlightRadarSignature = lineStrings && lineStrings.length > 0

    // Also check document name or description for additional clues
    const docNames = xmlDoc.getElementsByTagName("name")
    let docName = ""
    if (docNames && docNames.length > 0 && docNames[0].textContent) {
      docName = docNames[0].textContent
    }

    if (hasFlightAwareSignature || (docName && docName.includes("FlightAware"))) {
      source = "FlightAware"
      // console.log("Detected FlightAware KML format")

      // Process FlightAware format (gx:Track with gx:coord elements)
      for (let i = 0; i < gxTracks.length; i++) {
        try {
          const track = gxTracks[i]
          if (!track) continue

          // Get all gx:coord elements
          const gxCoords = track.getElementsByTagNameNS("http://www.google.com/kml/ext/2.2", "coord")
          // console.log(`Found ${gxCoords.length} gx:coord elements in track ${i + 1}`)

          if (gxCoords && gxCoords.length > 0) {
            for (let j = 0; j < gxCoords.length; j++) {
              if (gxCoords[j].textContent) {
                // FlightAware format: longitude latitude altitude (space-separated)
                const coordText = gxCoords[j].textContent.trim()
                const parts = coordText.split(/\s+/)

                if (parts.length >= 2) {
                  const lng = Number.parseFloat(parts[0])
                  const lat = Number.parseFloat(parts[1])
                  // Get altitude if available, otherwise default to 0
                  // KML altitude is in meters, convert to feet
                  const altitudeMeters = parts.length >= 3 ? Number.parseFloat(parts[2]) : 0
                  const altitudeFeet = Math.round(altitudeMeters * METERS_TO_FEET)

                  if (!isNaN(lat) && !isNaN(lng)) {
                    originalWaypoints.push({
                      id: `${Date.now()}-fa-${i}-${j}`,
                      name: String(originalWaypoints.length + 1).padStart(3, "0"),
                      lat,
                      lng,
                      altitude: altitudeFeet,
                      selected: false,
                    })
                  }
                }
              }
            }
          }
        } catch (err) {
          console.error(`Error processing FlightAware track ${i}:`, err)
        }
      }

      // If we found waypoints, we're done with FlightAware processing
      if (originalWaypoints.length > 0) {
        // console.log(`Found ${originalWaypoints.length} waypoints in FlightAware KML`)
      } else {
        // Fallback to standard KML processing if no waypoints were found
        // console.log("No waypoints found in FlightAware format, trying standard KML processing")
      }
    } else {
      source = "FlightRadar24"
      // console.log("Processing as FlightRadar24 KML format")
    }

    // If we haven't found waypoints yet, process as FlightRadar24 or standard KML
    if (originalWaypoints.length === 0) {
      // Process LineString elements (common in FlightRadar24)
      // console.log(`Found ${lineStrings.length} LineString elements`)

      for (let i = 0; i < lineStrings.length; i++) {
        try {
          const lineString = lineStrings[i]
          if (!lineString) continue

          const coordinatesElements = lineString.getElementsByTagName("coordinates")
          if (!coordinatesElements || coordinatesElements.length === 0 || !coordinatesElements[0].textContent) {
            continue
          }

          const coordinatesText = coordinatesElements[0].textContent.trim()
          if (!coordinatesText) continue

          // FlightRadar24 typically has one long string of coordinates separated by spaces
          const coordLines = coordinatesText.split(/\s+/)
          // console.log(`LineString ${i + 1}: Found ${coordLines.length} coordinate points`)

          if (coordLines.length > 0) {
            const waypoints = processCoordinates(coordLines, i, originalWaypoints.length)
            originalWaypoints.push(...waypoints)
          }
        } catch (err) {
          console.error(`Error processing LineString ${i}:`, err)
        }
      }

      // If we still have no waypoints, try other elements
      if (originalWaypoints.length === 0) {
        // console.log("No coordinates found in LineString elements, checking Placemarks...")

        // Try to find coordinates in Placemarks (alternative format)
        const placemarks = xmlDoc.getElementsByTagName("Placemark")
        // console.log(`Found ${placemarks.length} Placemark elements`)

        for (let i = 0; i < placemarks.length; i++) {
          try {
            const placemark = placemarks[i]
            if (!placemark) continue

            // Check for coordinates directly in the Placemark
            const coordinatesElements = placemark.getElementsByTagName("coordinates")
            if (coordinatesElements && coordinatesElements.length > 0 && coordinatesElements[0].textContent) {
              const coordinatesText = coordinatesElements[0].textContent.trim()
              if (coordinatesText) {
                const coordLines = coordinatesText.split(/\s+/)
                // console.log(`Placemark ${i + 1}: Found ${coordLines.length} coordinate points`)

                if (coordLines.length > 0) {
                  const waypoints = processCoordinates(coordLines, i, originalWaypoints.length)
                  originalWaypoints.push(...waypoints)
                }
              }
            }

            // Also check for Track elements (another possible format)
            const tracks = placemark.getElementsByTagName("Track")
            if (tracks && tracks.length > 0) {
              for (let j = 0; j < tracks.length; j++) {
                const track = tracks[j]
                if (!track) continue

                // Track can have coordinates in different formats
                // First check for <coord> elements
                const coordElements = track.getElementsByTagName("coord")
                if (coordElements && coordElements.length > 0) {
                  // console.log(`Track ${j + 1} in Placemark ${i + 1}: Found ${coordElements.length} coord elements`)

                  const trackCoords: string[] = []
                  for (let k = 0; k < coordElements.length; k++) {
                    if (coordElements[k].textContent) {
                      // Format is typically "lon lat alt"
                      const coordText = coordElements[k].textContent
                      // Convert to KML format "lon,lat,alt"
                      trackCoords.push(coordText.replace(/\s+/g, ","))
                    }
                  }

                  if (trackCoords.length > 0) {
                    const waypoints = processCoordinates(trackCoords, i * 1000 + j, originalWaypoints.length)
                    originalWaypoints.push(...waypoints)
                  }
                }
              }
            }
          } catch (err) {
            console.error(`Error processing Placemark ${i}:`, err)
          }
        }
      }

      // If we still have no waypoints, try one more approach - look for any coordinates element
      if (originalWaypoints.length === 0) {
        // console.log("Still no coordinates found, searching for any coordinates element...")

        const allCoordinatesElements = xmlDoc.getElementsByTagName("coordinates")
        // console.log(`Found ${allCoordinatesElements.length} coordinates elements in total`)

        for (let i = 0; i < allCoordinatesElements.length; i++) {
          try {
            if (!allCoordinatesElements[i].textContent) continue

            const coordinatesText = allCoordinatesElements[i].textContent.trim()
            if (!coordinatesText) continue

            const coordLines = coordinatesText.split(/\s+/)
            // console.log(`Coordinates element ${i + 1}: Found ${coordLines.length} coordinate points`)

            if (coordLines.length > 0) {
              const waypoints = processCoordinates(coordLines, i + 10000, originalWaypoints.length)
              originalWaypoints.push(...waypoints)
            }
          } catch (err) {
            console.error(`Error processing coordinates element ${i}:`, err)
          }
        }
      }
    }

    // console.log(`Total waypoints found in KML: ${originalWaypoints.length}`)

    // Save flight statistics if filename is provided and waypoints were found
    if (filename && originalWaypoints.length > 0) {
      try {
        const flightData = parseFlightFilename(filename)
        flightData.source = source

        // console.log("Parsed flight data:", flightData)
        // console.log("Origin airport parameter:", originAirport)
        // console.log("Destination airport parameter:", destinationAirport)

        // Save flight data asynchronously (don't wait for it)
        saveFlightData(flightData, originAirport, destinationAirport).catch((error) => {
          console.error("Failed to save flight statistics:", error)
        })
      } catch (error) {
        console.error("Error parsing flight filename:", error)
      }
    }

    // If we still have no waypoints, return empty result
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

    // Validate and clean the route
    const validatedWaypoints = validateAndCleanRoute(originalWaypoints)
    // console.log(`After validation: ${validatedWaypoints.length} waypoints`)

    // Simplify the waypoints
    const result = simplifyWaypoints(validatedWaypoints)

    // Add the source to the result
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

// Helper function to process coordinate lines into waypoints
function processCoordinates(coordLines: string[], placemarkIndex: number, startIndex: number): Waypoint[] {
  const waypoints: Waypoint[] = []

  for (let j = 0; j < coordLines.length; j++) {
    const coordLine = coordLines[j]
    if (!coordLine.trim()) continue

    // KML format is longitude,latitude,altitude
    const parts = coordLine.trim().split(",")

    if (parts.length >= 2) {
      const lng = Number.parseFloat(parts[0])
      const lat = Number.parseFloat(parts[1])
      // Get altitude if available, otherwise default to 0
      // KML altitude is in meters, convert to feet
      const altitudeMeters = parts.length >= 3 ? Number.parseFloat(parts[2]) : 0
      const altitudeFeet = Math.round(altitudeMeters * METERS_TO_FEET)

      if (!isNaN(lat) && !isNaN(lng)) {
        waypoints.push({
          id: `${Date.now()}-line-${placemarkIndex}-${j}`,
          name: String(startIndex + waypoints.length + 1).padStart(3, "0"),
          lat,
          lng,
          altitude: altitudeFeet,
          selected: false,
        })
      }
    }
  }

  return waypoints
}

// Function to validate and clean the route
function validateAndCleanRoute(waypoints: Waypoint[]): Waypoint[] {
  if (waypoints.length <= 2) {
    return waypoints
  }

  // Step 1: Remove duplicate waypoints (exact same coordinates)
  const uniqueWaypoints: Waypoint[] = []
  const seen = new Set<string>()

  for (const wp of waypoints) {
    const key = `${wp.lat.toFixed(6)},${wp.lng.toFixed(6)}`
    if (!seen.has(key)) {
      seen.add(key)
      uniqueWaypoints.push(wp)
    }
  }

  // Step 2: Detect and fix any route loops or duplicated segments
  if (uniqueWaypoints.length > 3) {
    const cleanedWaypoints: Waypoint[] = [uniqueWaypoints[0]]
    const visitedSegments = new Set<string>()

    for (let i = 1; i < uniqueWaypoints.length; i++) {
      const prev = uniqueWaypoints[i - 1]
      const current = uniqueWaypoints[i]

      // Create a segment key (from lower lat/lng to higher lat/lng to handle direction)
      const segmentKey = createSegmentKey(prev, current)

      // Skip if we've seen this segment before (potential loop)
      if (!visitedSegments.has(segmentKey)) {
        visitedSegments.add(segmentKey)
        cleanedWaypoints.push(current)
      }
    }

    // Ensure we always include the last waypoint
    if (cleanedWaypoints[cleanedWaypoints.length - 1] !== uniqueWaypoints[uniqueWaypoints.length - 1]) {
      cleanedWaypoints.push(uniqueWaypoints[uniqueWaypoints.length - 1])
    }

    return cleanedWaypoints
  }

  return uniqueWaypoints
}

// Helper to create a unique key for a segment between two waypoints
function createSegmentKey(wp1: Waypoint, wp2: Waypoint): string {
  // Order points by latitude then longitude to create a consistent key regardless of direction
  const [first, second] = [wp1, wp2].sort((a, b) => {
    if (a.lat !== b.lat) return a.lat - b.lat
    return a.lng - b.lng
  })

  return `${first.lat.toFixed(6)},${first.lng.toFixed(6)}-${second.lat.toFixed(6)},${second.lng.toFixed(6)}`
}

// Completely revised simplification function to ensure balanced distribution of waypoints
function simplifyWaypoints(waypoints: Waypoint[]): SimplificationResult {
  // Handle edge cases
  if (!waypoints || !Array.isArray(waypoints)) {
    return {
      waypoints: [],
      originalCount: 0,
      simplifiedCount: 0,
      simplificationReason: "Invalid waypoints array",
    }
  }

  const originalCount = waypoints.length
  let simplificationReason = ""

  // If we have fewer than 250 waypoints, just rename them and return
  if (originalCount <= 250) {
    const renamedWaypoints = waypoints.map((wp, index) => ({
      ...wp,
      name: String(index + 1).padStart(3, "0"),
    }))

    return {
      waypoints: renamedWaypoints,
      originalCount,
      simplifiedCount: originalCount,
      simplificationReason: "No simplification needed (fewer than 250 waypoints)",
    }
  }

  try {
    // For routes with more than 250 waypoints, we need to simplify
    // We'll ensure a balanced distribution as requested:
    // - 20% for departure/ground operations
    // - 60% for en-route
    // - 20% for arrival/ground operations

    // Calculate the number of waypoints for each segment
    const maxWaypoints = 250
    const departureCount = Math.max(Math.floor(maxWaypoints * 0.2), 10)
    const arrivalCount = Math.max(Math.floor(maxWaypoints * 0.2), 10)
    const enRouteCount = maxWaypoints - departureCount - arrivalCount

    // console.log(
    //   `Simplification targets: Departure=${departureCount}, En-route=${enRouteCount}, Arrival=${arrivalCount}`,
    // )

    // Determine the segments of the flight
    const departureSegment = waypoints.slice(0, Math.floor(waypoints.length * 0.2))
    const arrivalSegment = waypoints.slice(Math.floor(waypoints.length * 0.8))
    const enRouteSegment = waypoints.slice(Math.floor(waypoints.length * 0.2), Math.floor(waypoints.length * 0.8))

    // console.log(
    //   `Original segment sizes: Departure=${departureSegment.length}, En-route=${enRouteSegment.length}, Arrival=${arrivalSegment.length}`,
    // )

    // Now simplify each segment to the target count
    let simplifiedDeparture: Waypoint[]
    let simplifiedEnRoute: Waypoint[]
    let simplifiedArrival: Waypoint[]

    // Simplify departure segment - preserve more detail at the beginning
    if (departureSegment.length <= departureCount) {
      simplifiedDeparture = departureSegment
    } else {
      // Use a combination of methods to preserve important points
      const criticalPoints = identifyCriticalPoints(departureSegment, Math.floor(departureCount * 0.3))
      const remainingCount = departureCount - criticalPoints.length
      const simplifiedRemaining = douglasPeucker(
        departureSegment.filter((wp) => !criticalPoints.some((cp) => cp.id === wp.id)),
        remainingCount,
      )
      simplifiedDeparture = [...criticalPoints, ...simplifiedRemaining].sort((a, b) => {
        return departureSegment.findIndex((wp) => wp.id === a.id) - departureSegment.findIndex((wp) => wp.id === b.id)
      })
    }

    // Simplify en-route segment - can be more aggressive
    if (enRouteSegment.length <= enRouteCount) {
      simplifiedEnRoute = enRouteSegment
    } else {
      simplifiedEnRoute = douglasPeucker(enRouteSegment, enRouteCount)
    }

    // Simplify arrival segment - preserve more detail at the end
    if (arrivalSegment.length <= arrivalCount) {
      simplifiedArrival = arrivalSegment
    } else {
      // Use a combination of methods to preserve important points
      const criticalPoints = identifyCriticalPoints(arrivalSegment, Math.floor(arrivalCount * 0.3))
      const remainingCount = arrivalCount - criticalPoints.length
      const simplifiedRemaining = douglasPeucker(
        arrivalSegment.filter((wp) => !criticalPoints.some((cp) => cp.id === wp.id)),
        remainingCount,
      )
      simplifiedArrival = [...criticalPoints, ...simplifiedRemaining].sort((a, b) => {
        return arrivalSegment.findIndex((wp) => wp.id === a.id) - arrivalSegment.findIndex((wp) => wp.id === b.id)
      })
    }

    // console.log(
    //   `Simplified segment sizes: Departure=${simplifiedDeparture.length}, En-route=${simplifiedEnRoute.length}, Arrival=${simplifiedArrival.length}`,
    // )

    // Combine all segments
    const simplifiedWaypoints = [...simplifiedDeparture, ...simplifiedEnRoute, ...simplifiedArrival]

    // Ensure we don't have duplicates at segment boundaries
    const finalWaypoints: Waypoint[] = []
    const seenIds = new Set<string>()

    for (const wp of simplifiedWaypoints) {
      if (!seenIds.has(wp.id)) {
        seenIds.add(wp.id)
        finalWaypoints.push(wp)
      }
    }

    // Ensure we have the first and last waypoints
    const hasFirst = finalWaypoints.some((wp) => wp.id === waypoints[0].id)
    const hasLast = finalWaypoints.some((wp) => wp.id === waypoints[waypoints.length - 1].id)

    if (!hasFirst) {
      finalWaypoints.unshift(waypoints[0])
    }

    if (!hasLast) {
      finalWaypoints.push(waypoints[waypoints.length - 1])
    }

    // Rename waypoints to ensure sequential numbering (001, 002, 003...)
    const renamedWaypoints = finalWaypoints.map((wp, index) => ({
      ...wp,
      name: String(index + 1).padStart(3, "0"),
    }))

    simplificationReason = `Simplified from ${originalCount} to ${renamedWaypoints.length} waypoints, preserving departure (${simplifiedDeparture.length}), en-route (${simplifiedEnRoute.length}), and arrival (${simplifiedArrival.length}) segments`

    return {
      waypoints: renamedWaypoints,
      originalCount,
      simplifiedCount: renamedWaypoints.length,
      simplificationReason,
    }
  } catch (error) {
    console.error("Error during waypoint simplification:", error)

    // If our advanced simplification fails, fall back to a simpler approach
    // that still preserves the beginning, middle, and end of the route
    try {
      const first = waypoints.slice(0, Math.floor(waypoints.length * 0.05))
      const last = waypoints.slice(-Math.floor(waypoints.length * 0.05))

      // For the middle section, use evenly spaced points
      const middleStart = Math.floor(waypoints.length * 0.05)
      const middleEnd = waypoints.length - Math.floor(waypoints.length * 0.05)
      const middle = waypoints.slice(middleStart, middleEnd)

      const middleSimplified = selectEvenlySpacedWaypoints(middle, 240 - first.length - last.length)

      const combined = [...first, ...middleSimplified, ...last]

      // Rename waypoints
      const renamedWaypoints = combined.map((wp, index) => ({
        ...wp,
        name: String(index + 1).padStart(3, "0"),
      }))

      return {
        waypoints: renamedWaypoints,
        originalCount,
        simplifiedCount: renamedWaypoints.length,
        simplificationReason: `Fallback simplification from ${originalCount} to ${renamedWaypoints.length} waypoints, preserving start and end segments`,
      }
    } catch (fallbackError) {
      console.error("Fallback simplification also failed:", fallbackError)

      // Last resort: just take evenly spaced points
      const evenlySampled = selectEvenlySpacedWaypoints(waypoints, 250)

      const renamedWaypoints = evenlySampled.map((wp, index) => ({
        ...wp,
        name: String(index + 1).padStart(3, "0"),
      }))

      return {
        waypoints: renamedWaypoints,
        originalCount,
        simplifiedCount: renamedWaypoints.length,
        simplificationReason: `Emergency fallback simplification from ${originalCount} to ${renamedWaypoints.length} waypoints using evenly spaced selection`,
      }
    }
  }
}

// Helper function to identify critical points in a segment (turns, altitude changes)
function identifyCriticalPoints(waypoints: Waypoint[], maxPoints: number): Waypoint[] {
  if (waypoints.length <= 2) return waypoints

  // Always include first and last points
  const criticalPoints: Waypoint[] = [waypoints[0], waypoints[waypoints.length - 1]]

  // Calculate "importance" for each intermediate point
  const importanceScores: { waypoint: Waypoint; score: number }[] = []

  for (let i = 1; i < waypoints.length - 1; i++) {
    const prev = waypoints[i - 1]
    const curr = waypoints[i]
    const next = waypoints[i + 1]

    // Calculate turn angle
    const angle1 = Math.atan2(curr.lat - prev.lat, curr.lng - prev.lng)
    const angle2 = Math.atan2(next.lat - curr.lat, next.lng - curr.lng)
    let turnAngle = Math.abs(angle2 - angle1)

    // Normalize to [0, π]
    if (turnAngle > Math.PI) {
      turnAngle = 2 * Math.PI - turnAngle
    }

    // Calculate altitude change (using feet, as converted earlier)
    const altChange = Math.abs(next.altitude - prev.altitude)

    // Combined score (normalize turn angle to [0,1] range)
    // Altitude change is scaled to be comparable to angular change
    const score = turnAngle / Math.PI + altChange / 10000 // Divide by a larger number for altitude to prevent it from dominating

    importanceScores.push({ waypoint: curr, score })
  }

  // Sort by importance and take top points
  importanceScores.sort((a, b) => b.score - a.score)

  // Add top scoring points to critical points
  for (let i = 0; i < Math.min(maxPoints - 2, importanceScores.length); i++) {
    criticalPoints.push(importanceScores[i].waypoint)
  }

  return criticalPoints
}

// Helper function to select evenly spaced waypoints
function selectEvenlySpacedWaypoints(points: Waypoint[], targetCount: number): Waypoint[] {
  if (points.length <= targetCount) {
    return points
  }

  const result: Waypoint[] = []
  const step = points.length / targetCount

  // Always include the first point
  result.push(points[0])

  // Add evenly spaced points
  for (let i = 1; i < targetCount - 1; i++) {
    const index = Math.min(Math.floor(i * step), points.length - 1)
    result.push(points[index])
  }

  // Always include the last point
  if (points.length > 1) {
    result.push(points[points.length - 1])
  }

  return result
}

// Douglas-Peucker algorithm to simplify a path
function douglasPeucker(points: Waypoint[], targetCount: number): Waypoint[] {
  // Handle edge cases
  if (!points || !Array.isArray(points) || points.length <= 2) {
    return points || []
  }

  if (targetCount >= points.length) {
    return points
  }

  // Start with a very small tolerance and increase until we get fewer than targetCount points
  let tolerance = 0.00001
  let simplified = points
  let iterations = 0
  const maxIterations = 20 // Prevent infinite loops

  while (simplified.length > targetCount && tolerance < 1 && iterations < maxIterations) {
    try {
      simplified = douglasPeuckerRecursive(points, tolerance)
      tolerance *= 2
      iterations++
    } catch (error) {
      console.error("Error in Douglas-Peucker algorithm:", error)
      break
    }
  }

  // If we still have too many points, just take evenly spaced ones
  if (simplified.length > targetCount) {
    return selectEvenlySpacedWaypoints(simplified, targetCount)
  }

  return simplified
}

function douglasPeuckerRecursive(points: Waypoint[], tolerance: number): Waypoint[] {
  if (!points || points.length <= 2) {
    return points || []
  }

  // Find the point with the maximum distance
  let maxDistance = 0
  let maxDistanceIndex = 0

  const firstPoint = points[0]
  const lastPoint = points[points.length - 1]

  for (let i = 1; i < points.length - 1; i++) {
    const distance = perpendicularDistance(points[i], firstPoint, lastPoint)

    if (distance > maxDistance) {
      maxDistance = distance
      maxDistanceIndex = i
    }
  }

  // If max distance is greater than tolerance, recursively simplify
  if (maxDistance > tolerance) {
    // Split the points and recursively simplify
    const firstHalf = douglasPeuckerRecursive(points.slice(0, maxDistanceIndex + 1), tolerance)
    const secondHalf = douglasPeuckerRecursive(points.slice(maxDistanceIndex), tolerance)

    // Concatenate the two halves, removing the duplicate point
    return [...firstHalf.slice(0, -1), ...secondHalf]
  } else {
    // All points in this segment are within tolerance, so simplify to just the endpoints
    return [firstPoint, lastPoint]
  }
}

// Calculate perpendicular distance from a point to a line
function perpendicularDistance(point: Waypoint, lineStart: Waypoint, lineEnd: Waypoint): number {
  if (!point || !lineStart || !lineEnd) {
    return 0
  }

  const x = point.lng
  const y = point.lat
  const x1 = lineStart.lng
  const y1 = lineStart.lat
  const x2 = lineEnd.lng
  const y2 = lineEnd.lat

  // If the line is just a point, return the distance to that point
  if (x1 === x2 && y1 === y2) {
    return Math.sqrt(Math.pow(x - x1, 2) + Math.pow(y - y1, 2))
  }

  // Calculate the perpendicular distance
  const numerator = Math.abs((y2 - y1) * x - (x2 - x1) * y + x2 * y1 - y2 * x1)
  const denominator = Math.sqrt(Math.pow(y2 - y1, 2) + Math.pow(x2 - x1, 2))

  return numerator / denominator
}
