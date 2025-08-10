interface Waypoint {
  id: string
  name: string
  lat: number
  lng: number
  altitude: number
  selected?: boolean
}

// Conversion factor from feet to meters (1 foot = 0.3048 meters)
const FEET_TO_METERS = 0.3048

export function generateFPL(waypoints: Waypoint[]): string {
  if (waypoints.length === 0) {
    return ""
  }

  // Create Garmin Flight Plan XML format
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
  xml += '<flight-plan xmlns="http://www8.garmin.com/xmlschemas/FlightPlan/v1">\n'
  xml += "  <created>2023-04-14T12:00:00Z</created>\n"
  xml += "  <waypoint-table>\n"

  // Add waypoints to the waypoint table
  waypoints.forEach((waypoint, index) => {
    xml += "    <waypoint>\n"
    xml += `      <identifier>${waypoint.name}</identifier>\n`
    xml += "      <type>USER WAYPOINT</type>\n"
    xml += `      <lat>${waypoint.lat.toFixed(6)}</lat>\n`
    xml += `      <lon>${waypoint.lng.toFixed(6)}</lon>\n`

    // Add elevation/altitude in meters (Garmin FPL schema expects meters)
    if (waypoint.altitude) {
      // Convert altitude from feet (internal representation) to meters for export
      const altitudeMeters = Math.round(waypoint.altitude * FEET_TO_METERS)
      xml += `      <elevation>${altitudeMeters}</elevation>\n`
    }

    xml += "    </waypoint>\n"
  })

  xml += "  </waypoint-table>\n"
  xml += "  <route>\n"
  xml += "    <route-name>IMPORTED ROUTE</route-name>\n"
  xml += "    <flight-plan-index>1</flight-plan-index>\n"

  // Add route points referencing the waypoints
  waypoints.forEach((waypoint, index) => {
    xml += "    <route-point>\n"
    xml += `      <waypoint-identifier>${waypoint.name}</waypoint-identifier>\n`
    xml += "      <waypoint-type>USER WAYPOINT</waypoint-type>\n"
    xml += `      <waypoint-country-code></waypoint-country-code>\n`
    xml += "    </route-point>\n"
  })

  xml += "  </route>\n"
  xml += "</flight-plan>\n"

  return xml
}
