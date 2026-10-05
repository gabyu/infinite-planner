// A saved timezone is only used if the browser can actually format with it; otherwise
// (null, or a name this browser doesn't know) fall back to the browser-detected one.
export function isValidTimezone(tz: string | null | undefined): tz is string {
  if (!tz) return false
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz })
    return true
  } catch {
    return false
  }
}

export function detectBrowserTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
}

export function resolveTimezone(saved: string | null | undefined) {
  return isValidTimezone(saved) ? saved : detectBrowserTimezone()
}

export function listTimezones(): string[] {
  const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] }
  const zones = intl.supportedValuesOf?.("timeZone") ?? []
  return zones.includes("UTC") ? zones : ["UTC", ...zones]
}
