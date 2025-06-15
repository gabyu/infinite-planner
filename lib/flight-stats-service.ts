import { getSupabaseClient } from "./supabase"

export interface FlightData {
  flight_number?: string
  origin_airport?: string
  destination_airport?: string
  date?: string
  source?: string // 'FlightRadar24' or 'FlightAware'
  filename: string
}

export interface AirportStats {
  airport_code: string
  count: number
}

export interface FlightStats {
  flight_number: string
  count: number
}

// Parse filename to extract flight information
export function parseFlightFilename(filename: string): FlightData {
  const result: FlightData = { filename }

  // Remove file extension
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, "")

  // Pattern for FlightAware format: "FlightAware_KLM605_EHAM_KSFO_20250526"
  const flightAwarePattern = /^FlightAware_([A-Z0-9]+)_([A-Z]{4})_([A-Z]{4})_(\d{8})$/i
  const flightAwareMatch = nameWithoutExt.match(flightAwarePattern)

  if (flightAwareMatch) {
    result.source = "FlightAware"
    result.flight_number = flightAwareMatch[1]
    result.origin_airport = flightAwareMatch[2]
    result.destination_airport = flightAwareMatch[3]
    result.date = flightAwareMatch[4]
    return result
  }

  // Pattern for FlightRadar24 format: "MU219-3a965446" or similar
  const flightRadarPattern = /^([A-Z]{1,3}\d+)/i
  const flightRadarMatch = nameWithoutExt.match(flightRadarPattern)

  if (flightRadarMatch) {
    result.source = "FlightRadar24"
    result.flight_number = flightRadarMatch[1]
    return result
  }

  // Try to extract any flight number pattern
  const generalFlightPattern = /([A-Z]{1,3}\d+)/i
  const generalMatch = nameWithoutExt.match(generalFlightPattern)

  if (generalMatch) {
    result.flight_number = generalMatch[1]
  }

  // Try to extract airport codes (4-letter codes)
  const airportPattern = /\b([A-Z]{4})\b/g
  const airportMatches = nameWithoutExt.match(airportPattern)

  if (airportMatches && airportMatches.length >= 2) {
    result.origin_airport = airportMatches[0]
    result.destination_airport = airportMatches[1]
  }

  return result
}

// Save flight data to Supabase
export async function saveFlightData(
  flightData: FlightData,
  originAirport?: string,
  destinationAirport?: string,
): Promise<boolean> {
  try {
    // Check if Supabase is properly configured
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.warn("Supabase not configured, flight data not saved")
      return false
    }

    const supabase = getSupabaseClient()

    // Use the provided origin/destination from UI if available, otherwise use parsed data
    const finalOriginAirport = originAirport || flightData.origin_airport
    const finalDestinationAirport = destinationAirport || flightData.destination_airport

    // Insert flight data
    const { error } = await supabase.from("flight_statistics").insert([
      {
        flight_number: flightData.flight_number,
        origin_airport: finalOriginAirport,
        destination_airport: finalDestinationAirport,
        flight_date: flightData.date,
        source: flightData.source,
        filename: flightData.filename,
        created_at: new Date().toISOString(),
      },
    ])

    if (error) {
      console.error("Error saving flight data:", error)
      return false
    }

    console.log("Flight data saved successfully:", {
      ...flightData,
      origin_airport: finalOriginAirport,
      destination_airport: finalDestinationAirport,
    })
    return true
  } catch (error) {
    console.error("Exception saving flight data:", error)
    return false
  }
}

// Get popular airports (both origin and destination)
export async function getPopularAirports(limit = 10): Promise<AirportStats[]> {
  try {
    // Check if Supabase is properly configured
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.warn("Supabase not configured, returning empty airport stats")
      return []
    }

    const supabase = getSupabaseClient()

    // Get origin airports
    const { data: originData, error: originError } = await supabase
      .from("flight_statistics")
      .select("origin_airport")
      .not("origin_airport", "is", null)

    // Get destination airports
    const { data: destData, error: destError } = await supabase
      .from("flight_statistics")
      .select("destination_airport")
      .not("destination_airport", "is", null)

    if (originError || destError) {
      console.error("Error fetching airport data:", originError || destError)
      return []
    }

    // Combine and count airports
    const airportCounts: { [key: string]: number } = {}

    // Count origin airports
    if (originData) {
      originData.forEach((row) => {
        if (row.origin_airport) {
          airportCounts[row.origin_airport] = (airportCounts[row.origin_airport] || 0) + 1
        }
      })
    }

    // Count destination airports
    if (destData) {
      destData.forEach((row) => {
        if (row.destination_airport) {
          airportCounts[row.destination_airport] = (airportCounts[row.destination_airport] || 0) + 1
        }
      })
    }

    // Convert to array and sort by count
    const sortedAirports = Object.entries(airportCounts)
      .map(([airport_code, count]) => ({ airport_code, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)

    return sortedAirports
  } catch (error) {
    console.error("Error fetching popular airports:", error)
    return []
  }
}

// Get popular flights
export async function getPopularFlights(limit = 10): Promise<FlightStats[]> {
  try {
    // Check if Supabase is properly configured
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.warn("Supabase not configured, returning empty flight stats")
      return []
    }

    const supabase = getSupabaseClient()

    // Get flight numbers and count them
    const { data, error } = await supabase
      .from("flight_statistics")
      .select("flight_number")
      .not("flight_number", "is", null)

    if (error) {
      console.error("Error fetching flight data:", error)
      return []
    }

    if (!data) {
      return []
    }

    // Count flight numbers
    const flightCounts: { [key: string]: number } = {}

    data.forEach((row) => {
      if (row.flight_number) {
        flightCounts[row.flight_number] = (flightCounts[row.flight_number] || 0) + 1
      }
    })

    // Convert to array and sort by count
    const sortedFlights = Object.entries(flightCounts)
      .map(([flight_number, count]) => ({ flight_number, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)

    return sortedFlights
  } catch (error) {
    console.error("Error fetching popular flights:", error)
    return []
  }
}

// Get total statistics
export async function getTotalStats(): Promise<{ totalFlights: number; totalAirports: number }> {
  try {
    // Check if Supabase is properly configured
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return { totalFlights: 0, totalAirports: 0 }
    }

    const supabase = getSupabaseClient()

    // Get total number of flights
    const { count: totalFlights, error: flightError } = await supabase
      .from("flight_statistics")
      .select("*", { count: "exact", head: true })

    if (flightError) {
      console.error("Error fetching total flights:", flightError)
      return { totalFlights: 0, totalAirports: 0 }
    }

    // Get unique airports
    const { data: airportData, error: airportError } = await supabase
      .from("flight_statistics")
      .select("origin_airport, destination_airport")

    if (airportError) {
      console.error("Error fetching airport data:", airportError)
      return { totalFlights: totalFlights || 0, totalAirports: 0 }
    }

    // Count unique airports
    const uniqueAirports = new Set<string>()
    if (airportData) {
      airportData.forEach((row) => {
        if (row.origin_airport) uniqueAirports.add(row.origin_airport)
        if (row.destination_airport) uniqueAirports.add(row.destination_airport)
      })
    }

    return {
      totalFlights: totalFlights || 0,
      totalAirports: uniqueAirports.size,
    }
  } catch (error) {
    console.error("Error fetching total stats:", error)
    return { totalFlights: 0, totalAirports: 0 }
  }
}
