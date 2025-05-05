// This file contains functions to identify airports from waypoint data

interface Waypoint {
  lat: number
  lng: number
  altitude?: number
}

// Database of major airports with coordinates (simplified example)
// In a real implementation, this would be a comprehensive database
const AIRPORTS = [
  { code: "KLAX", name: "Los Angeles", lat: 33.9416, lng: -118.4085 },
  { code: "KJFK", name: "New York JFK", lat: 40.6413, lng: -73.7781 },
  { code: "EGLL", name: "London Heathrow", lat: 51.47, lng: -0.4543 },
  { code: "EDDF", name: "Frankfurt", lat: 50.0379, lng: 8.5622 },
  // Add more airports...
]

/**
 * Identifies the most likely departure and arrival airports given a set of waypoints
 */
export function identifyRoute(waypoints: Waypoint[]): string | null {
  if (!waypoints || waypoints.length < 2) {
    return null
  }

  // Get first and last waypoints
  const firstWaypoint = waypoints[0]
  const lastWaypoint = waypoints[waypoints.length - 1]

  // Find closest airport to first waypoint (likely departure)
  const departure = findClosestAirport(firstWaypoint)

  // Find closest airport to last waypoint (likely arrival)
  const arrival = findClosestAirport(lastWaypoint)

  if (departure && arrival) {
    return `${departure.code} → ${arrival.code}`
  }

  return null
}

/**
 * Finds the closest airport to a given waypoint using the Haversine formula
 */
function findClosestAirport(waypoint: Waypoint) {
  let closestAirport = null
  let minDistance = Number.POSITIVE_INFINITY

  for (const airport of AIRPORTS) {
    const distance = calculateDistance(waypoint.lat, waypoint.lng, airport.lat, airport.lng)

    // If this airport is closer than the current closest
    if (distance < minDistance) {
      minDistance = distance
      closestAirport = airport
    }
  }

  // Only return if the airport is reasonably close (within ~30km)
  return minDistance < 30 ? closestAirport : null
}

/**
 * Calculates distance between two points using the Haversine formula
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371 // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1)
  const dLon = deg2rad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function deg2rad(deg: number): number {
  return deg * (Math.PI / 180)
}
