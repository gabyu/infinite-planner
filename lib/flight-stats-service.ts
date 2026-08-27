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

    // Determine final origin and destination based on source
    let finalOriginAirport: string | undefined
    let finalDestinationAirport: string | undefined

    if (flightData.source === "FlightRadar24") {
      // For FlightRadar24, use user-entered airport codes from UI
      finalOriginAirport = originAirport && originAirport.trim() !== "" ? originAirport : undefined
      finalDestinationAirport = destinationAirport && destinationAirport.trim() !== "" ? destinationAirport : undefined
    } else {
      // For FlightAware and other sources, use parsed data from filename
      finalOriginAirport = flightData.origin_airport
      finalDestinationAirport = flightData.destination_airport
    }

    console.log("Saving flight data:", {
      flight_number: flightData.flight_number,
      origin_airport: finalOriginAirport,
      destination_airport: finalDestinationAirport,
      flight_date: flightData.date,
      source: flightData.source,
      filename: flightData.filename,
    })

    // Insert flight data
    const { data, error } = await supabase
      .from("flight_statistics")
      .insert([
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
      .select()

    if (error) {
      console.error("Error saving flight data:", error)
      return false
    }

    console.log("Flight data saved successfully:", data)
    return true
  } catch (error) {
    console.error("Exception saving flight data:", error)
    return false
  }
}

// Get popular airports (both origin and destination)
//
// Aggregated in Postgres via the get_popular_airports() function (see
// supabase-stats-functions.sql) instead of fetching every row and counting
// client-side - Supabase caps unpaginated selects at 1000 rows, which used
// to silently freeze this ranking on the first ~1000 flights ever imported.
export async function getPopularAirports(limit = 10): Promise<AirportStats[]> {
  try {
    // Check if Supabase is properly configured
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.warn("Supabase not configured, returning empty airport stats")
      return []
    }

    const supabase = getSupabaseClient()

    const { data, error } = await supabase.rpc("get_popular_airports", { result_limit: limit })

    if (error) {
      console.error("Error fetching airport data:", error)
      return []
    }

    return (data || []).map((row: { airport_code: string; count: number }) => ({
      airport_code: row.airport_code,
      count: Number(row.count),
    }))
  } catch (error) {
    console.error("Error fetching popular airports:", error)
    return []
  }
}

// Get popular flights
//
// Aggregated in Postgres via the get_popular_flights() function (see
// supabase-stats-functions.sql) for the same reason as getPopularAirports.
export async function getPopularFlights(limit = 10): Promise<FlightStats[]> {
  try {
    // Check if Supabase is properly configured
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.warn("Supabase not configured, returning empty flight stats")
      return []
    }

    const supabase = getSupabaseClient()

    const { data, error } = await supabase.rpc("get_popular_flights", { result_limit: limit })

    if (error) {
      console.error("Error fetching flight data:", error)
      return []
    }

    return (data || []).map((row: { flight_number: string; count: number }) => ({
      flight_number: row.flight_number,
      count: Number(row.count),
    }))
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

    // Get unique airports - counted in Postgres via get_unique_airport_count()
    // (see supabase-stats-functions.sql), same reasoning as getPopularAirports:
    // fetching every row client-side used to be silently capped at 1000.
    const { data: totalAirports, error: airportError } = await supabase.rpc("get_unique_airport_count")

    if (airportError) {
      console.error("Error fetching airport data:", airportError)
      return { totalFlights: totalFlights || 0, totalAirports: 0 }
    }

    return {
      totalFlights: totalFlights || 0,
      totalAirports: Number(totalAirports) || 0,
    }
  } catch (error) {
    console.error("Error fetching total stats:", error)
    return { totalFlights: 0, totalAirports: 0 }
  }
}
