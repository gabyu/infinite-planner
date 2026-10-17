/**
 * Single source of truth for Leaflet basemap tiles. Changing provider or style
 * (e.g. a future custom vector style) happens here only.
 *
 * Provider: CARTO basemaps (free key required, attribution required).
 * Label-free variants: airports get their own labels on the map.
 */

export type BasemapTheme = "light" | "dark"

const CARTO_BASE = "https://basemaps.cartocdn.com/rastertiles"
// Free key from https://www.carto.com/basemaps/apikey/ (no account; 1M requests/month for commercial use).
// Without it CARTO serves "API KEY REQUIRED" watermarked tiles.
const CARTO_KEY = process.env.NEXT_PUBLIC_CARTO_BASEMAPS_KEY
const KEY_QUERY = CARTO_KEY ? `?key=${encodeURIComponent(CARTO_KEY)}` : ""

export const BASEMAP_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'

export const BASEMAP_MAX_ZOOM = 19

const TILE_URLS: Record<BasemapTheme, string> = {
  light: `${CARTO_BASE}/light_nolabels/{z}/{x}/{y}{r}.png${KEY_QUERY}`,
  dark: `${CARTO_BASE}/dark_nolabels/{z}/{x}/{y}{r}.png${KEY_QUERY}`,
}

// Minimal structural types so this module does not depend on how Leaflet is loaded.
interface LeafletLike {
  tileLayer: (url: string, options: Record<string, unknown>) => { addTo: (map: any) => unknown }
  TileLayer: new (...args: any[]) => unknown
}

/** Replaces any existing tile layer on the map with the basemap for the theme. */
export function setBasemap(L: LeafletLike, map: any, isDark: boolean) {
  map.eachLayer((layer: unknown) => {
    if (layer instanceof L.TileLayer) map.removeLayer(layer)
  })
  L.tileLayer(TILE_URLS[isDark ? "dark" : "light"], {
    attribution: BASEMAP_ATTRIBUTION,
    maxZoom: BASEMAP_MAX_ZOOM,
  }).addTo(map)
}
