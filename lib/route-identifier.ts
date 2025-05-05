// This file contains functions to identify airports from waypoint data

interface Waypoint {
  lat: number
  lng: number
  altitude?: number
}

// Database of major airports with coordinates (simplified example)
// In a real implementation, this would be a comprehensive database
const AIRPORTS = [
  { "code": "KATL", "name": "Hartsfield–Jackson Atlanta International Airport", "lat": 33.6407, "lng": -84.4277 },
  { "code": "OMDB", "name": "Dubai International Airport", "lat": 25.2532, "lng": 55.3657 },
  { "code": "KDFW", "name": "Dallas Fort Worth International Airport", "lat": 32.8998, "lng": -97.0403 },
  { "code": "RJTT", "name": "Tokyo Haneda Airport", "lat": 35.5494, "lng": 139.7798 },
  { "code": "EGLL", "name": "Heathrow Airport", "lat": 51.4700, "lng": -0.4543 },
  { "code": "KDEN", "name": "Denver International Airport", "lat": 39.8561, "lng": -104.6737 },
  { "code": "KORD", "name": "O'Hare International Airport", "lat": 41.9742, "lng": -87.9073 },
  { "code": "LTFM", "name": "Istanbul Airport", "lat": 41.2753, "lng": 28.7519 },
  { "code": "VIDP", "name": "Indira Gandhi International Airport", "lat": 28.5562, "lng": 77.1000 },
  { "code": "ZSPD", "name": "Shanghai Pudong International Airport", "lat": 31.1443, "lng": 121.8083 },
  { "code": "KLAX", "name": "Los Angeles International Airport", "lat": 33.9416, "lng": -118.4085 },
  { "code": "ZBAA", "name": "Beijing Capital International Airport", "lat": 40.0801, "lng": 116.5846 },
  { "code": "LFPG", "name": "Charles de Gaulle Airport", "lat": 49.0097, "lng": 2.5479 },
  { "code": "EHAM", "name": "Amsterdam Airport Schiphol", "lat": 52.3105, "lng": 4.7683 },
  { "code": "KSFO", "name": "San Francisco International Airport", "lat": 37.6213, "lng": -122.3790 },
  { "code": "ZGGG", "name": "Guangzhou Baiyun International Airport", "lat": 23.3924, "lng": 113.2988 },
  { "code": "EDDF", "name": "Frankfurt Airport", "lat": 50.0379, "lng": 8.5622 },
  { "code": "KSEA", "name": "Seattle–Tacoma International Airport", "lat": 47.4502, "lng": -122.3088 },
  { "code": "CYYZ", "name": "Toronto Pearson International Airport", "lat": 43.6777, "lng": -79.6248 },
  { "code": "WSSS", "name": "Singapore Changi Airport", "lat": 1.3644, "lng": 103.9915 },
  { "code": "RKSI", "name": "Incheon International Airport", "lat": 37.4602, "lng": 126.4407 },
  { "code": "KPHX", "name": "Phoenix Sky Harbor International Airport", "lat": 33.4342, "lng": -112.0116 },
  { "code": "ZUCK", "name": "Chongqing Jiangbei International Airport", "lat": 29.7192, "lng": 106.6417 },
  { "code": "ZSHC", "name": "Hangzhou Xiaoshan International Airport", "lat": 30.2295, "lng": 120.4345 },
  { "code": "ZSSS", "name": "Shanghai Hongqiao International Airport", "lat": 31.1979, "lng": 121.3363 },
  { "code": "ZPPP", "name": "Kunming Changshui International Airport", "lat": 25.1019, "lng": 102.9292 },
  { "code": "ZLXY", "name": "Xi'an Xianyang International Airport", "lat": 34.4471, "lng": 108.7516 },
  { "code": "SKBO", "name": "El Dorado International Airport", "lat": 4.7016, "lng": -74.1469 },
  { "code": "MMMX", "name": "Mexico City International Airport", "lat": 19.4361, "lng": -99.0719 },
  { "code": "WIII", "name": "Soekarno–Hatta International Airport", "lat": -6.1256, "lng": 106.6559 },
  { "code": "WMKK", "name": "Kuala Lumpur International Airport", "lat": 2.7456, "lng": 101.7072 },
  { "code": "KIAH", "name": "George Bush Intercontinental Airport", "lat": 29.9902, "lng": -95.3368 },
  { "code": "OTHH", "name": "Hamad International Airport", "lat": 25.2731, "lng": 51.6085 },
  { "code": "RPLL", "name": "Ninoy Aquino International Airport", "lat": 14.5086, "lng": 121.0198 },
  { "code": "ZUTF", "name": "Chengdu Tianfu International Airport", "lat": 30.3139, "lng": 104.4440 },
  { "code": "OEJN", "name": "King Abdulaziz International Airport", "lat": 21.6796, "lng": 39.1565 },
  { "code": "SBGR", "name": "São Paulo/Guarulhos International Airport", "lat": -23.4356, "lng": -46.4731 },
  { "code": "EGKK", "name": "Gatwick Airport", "lat": 51.1537, "lng": -0.1821 },
  { "code": "KBOS", "name": "Logan International Airport", "lat": 42.3656, "lng": -71.0096 },
  { "code": "VVTS", "name": "Tan Son Nhat International Airport", "lat": 10.8188, "lng": 106.6519 },
  { "code": "KCLT", "name": "Charlotte Douglas International Airport", "lat": 35.2140, "lng": -80.9431 },
  { "code": "VHHH", "name": "Hong Kong International Airport", "lat": 22.3080, "lng": 113.9185 },
  { "code": "ZGSZ", "name": "Shenzhen Bao'an International Airport", "lat": 22.6393, "lng": 113.8107 },
  { "code": "KMSP", "name": "Minneapolis–Saint Paul International Airport", "lat": 44.8848, "lng": -93.2223 },
  { "code": "KDTW", "name": "Detroit Metropolitan Airport", "lat": 42.2162, "lng": -83.3554 },
  { "code": "RJAA", "name": "Narita International Airport", "lat": 35.7720, "lng": 140.3929 },
  { "code": "LEMD", "name": "Adolfo Suárez Madrid–Barajas Airport", "lat": 40.4983, "lng": -3.5676 },
  { "code": "LFPO", "name": "Paris Orly Airport", "lat": 48.7262, "lng": 2.3652 },
  { "code": "EDDM", "name": "Munich Airport", "lat": 48.3538, "lng": 11.7861 },
  { "code": "LIRF", "name": "Leonardo da Vinci–Fiumicino Airport", "lat": 41.8003, "lng": 12.2389 }
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
