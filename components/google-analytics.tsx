"use client"

import { useEffect, useState } from "react"
import Script from "next/script"
import { COOKIE_CONSENT_CHANGED_EVENT, type CookieConsent, getStoredConsent } from "@/lib/cookie-consent"

const GA_MEASUREMENT_ID = "G-BBLYJRGP2N"

// Loads gtag.js only once the visitor has actively consented to analytics -
// nothing is injected on page load, and a later "Reject" also flips Google's
// own opt-out flag so an already-loaded session stops sending hits too.
export function GoogleAnalytics() {
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false)

  useEffect(() => {
    const stored = getStoredConsent()
    setAnalyticsEnabled(!!stored?.analytics)

    const handleConsentChange = (event: Event) => {
      const consent = (event as CustomEvent<CookieConsent>).detail
      setAnalyticsEnabled(consent.analytics)
      ;(window as any)[`ga-disable-${GA_MEASUREMENT_ID}`] = !consent.analytics
    }

    window.addEventListener(COOKIE_CONSENT_CHANGED_EVENT, handleConsentChange)
    return () => window.removeEventListener(COOKIE_CONSENT_CHANGED_EVENT, handleConsentChange)
  }, [])

  if (!analyticsEnabled) return null

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`} strategy="afterInteractive" />
      <Script id="google-analytics-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}');
        `}
      </Script>
    </>
  )
}
