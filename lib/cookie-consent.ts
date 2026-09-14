// Minimal consent store: Infinite Planner only ever sets one optional
// cookie (Google Analytics), so consent is a single boolean rather than a
// multi-category preference center. Stored in localStorage (not a cookie
// itself) and broadcast via window events so the banner, the GA loader, and
// the footer's "Cookie preferences" link can all stay in sync without a
// shared React context.

export interface CookieConsent {
  analytics: boolean
  decided: boolean
  timestamp: number
}

const STORAGE_KEY = "ip_cookie_consent"
export const COOKIE_CONSENT_CHANGED_EVENT = "ip-cookie-consent-changed"
export const COOKIE_PREFERENCES_OPEN_EVENT = "ip-cookie-preferences-open"

export function getStoredConsent(): CookieConsent | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as CookieConsent) : null
  } catch {
    return null
  }
}

export function setConsent(analytics: boolean) {
  const consent: CookieConsent = { analytics, decided: true, timestamp: Date.now() }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(consent))
  } catch {
    // localStorage unavailable (private browsing etc.) - consent just won't
    // persist across visits, which defaults safely back to "not decided".
  }
  window.dispatchEvent(new CustomEvent<CookieConsent>(COOKIE_CONSENT_CHANGED_EVENT, { detail: consent }))
}

// Used by the footer's "Cookie preferences" link to reopen the banner so
// people can change their mind just as easily as they gave consent.
export function openCookiePreferences() {
  window.dispatchEvent(new Event(COOKIE_PREFERENCES_OPEN_EVENT))
}
