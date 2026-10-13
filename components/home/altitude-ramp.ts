// Colour of a route by altitude: cyan near the ground, through blue, to violet at cruise.
// Four evenly spaced stops from 0 ft to RAMP_MAX_FT (same idea as FlightRadar24's altitude colours,
// kept inside the site's blue family). Shared by the globe shader and the legend.
export const RAMP_MAX_FT = 40000

export const ALTITUDE_RAMP = {
  light: ["#06b6d4", "#2563eb", "#6a3fe6", "#a22fe0"],
  dark: ["#22d3ee", "#60a5fa", "#9585f6", "#c27bfa"],
} as const
