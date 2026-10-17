/**
 * Single source of truth for Leaflet basemap tiles. Changing provider or style
 * (e.g. a future custom vector style) happens here only.
 *
 * Provider: CARTO basemaps (free key required, attribution required).
 * Label-free variants: airports get their own labels on the map.
 */

export type BasemapTheme = "light" | "dark" | "colour"

/** What a person picks: Auto follows the site theme (light or dark). */
export type BasemapChoice = "auto" | BasemapTheme

export const BASEMAP_CHOICES: BasemapChoice[] = ["auto", "light", "dark", "colour"]

/** The palette family of a tile style, for the route colours drawn over it. */
export const basemapTone = (theme: BasemapTheme): "light" | "dark" => (theme === "dark" ? "dark" : "light")

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
  colour: `${CARTO_BASE}/voyager_nolabels/{z}/{x}/{y}{r}.png${KEY_QUERY}`,
}

// Minimal structural types so this module does not depend on how Leaflet is loaded.
interface LeafletLike {
  tileLayer: (url: string, options: Record<string, unknown>) => { addTo: (map: any) => unknown }
  TileLayer: new (...args: any[]) => unknown
}

export const resolveBasemap = (choice: BasemapChoice, siteIsDark: boolean): BasemapTheme =>
  choice === "auto" ? (siteIsDark ? "dark" : "light") : choice

const STORAGE_KEY = "infinite-planner:basemap"

export function loadBasemapChoice(): BasemapChoice {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    return BASEMAP_CHOICES.includes(value as BasemapChoice) ? (value as BasemapChoice) : "auto"
  } catch {
    return "auto"
  }
}

export function saveBasemapChoice(choice: BasemapChoice) {
  try {
    window.localStorage.setItem(STORAGE_KEY, choice)
  } catch {
    // Storage unavailable: the choice just lasts for this visit.
  }
}

/** Replaces any existing tile layer on the map with the basemap for the theme. A boolean means light or dark. */
export function setBasemap(L: LeafletLike, map: any, theme: BasemapTheme | boolean) {
  map.eachLayer((layer: unknown) => {
    if (layer instanceof L.TileLayer) map.removeLayer(layer)
  })
  const resolved: BasemapTheme = typeof theme === "boolean" ? (theme ? "dark" : "light") : theme
  L.tileLayer(TILE_URLS[resolved], {
    attribution: BASEMAP_ATTRIBUTION,
    maxZoom: BASEMAP_MAX_ZOOM,
  }).addTo(map)
}
