import type React from "react"
import type { Metadata } from "next"

// Load Vercel Speed Insights for performance monitoring - using stable version
import { SpeedInsights } from "@vercel/speed-insights/react"

import { IBM_Plex_Mono } from "next/font/google"
import localFont from "next/font/local"
import { GeistSans } from "geist/font/sans"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { GoogleAnalytics } from "@/components/google-analytics"
import { CookieConsentBanner } from "@/components/cookie-consent-banner"

// Type system. Text: Geist (light, clean; ships with the geist package, served from our own domain).
// Headlines: Funnel Display, self-hosted from app/fonts (SIL OFL; not in Next's Google list).
// Digits and codes: IBM Plex Mono (Maison Mono is a paid font). next/font downloads it at build time
// and serves it from our domain, so the browser never calls Google.
const funnelDisplay = localFont({
  src: "./fonts/FunnelDisplay-Variable.woff2",
  weight: "300 800",
  display: "swap",
  variable: "--font-funnel-display",
})

const ibmPlexMono = IBM_Plex_Mono({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-ibm-plex-mono",
})

const isStaging = process.env.NEXT_PUBLIC_ENV === "staging"
const siteUrl = isStaging ? "https://staging830921-infiniteplanner.gabyu.com/" : "https://infiniteplanner.gabyu.com/"

export const metadata: Metadata = {
  // Makes every relative og:image / canonical URL absolute on the right domain (crawlers need that).
  metadataBase: new URL(siteUrl),
  title: "Infinite Planner - The Flight Plan Hub for Infinite Flight",
  description:
    "The Flight Plan Hub for Infinite Flight. Import KML files from FlightRadar24 or FlightAware, or draw a route from scratch, and export it as an Infinite Flight flight plan.",
  icons: {
    icon: "/favicon.svg",
    apple: "/favicon.svg",
  },
  // Staging must not be indexed since it has no password protection
  ...(isStaging ? { robots: { index: false, follow: false } } : {}),
  // Add OpenGraph metadata for social media sharing
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    title: "Infinite Planner - The Flight Plan Hub for Infinite Flight",
    description: "The Flight Plan Hub for Infinite Flight.",
    siteName: "Infinite Planner",
    images: [
      {
        url: "/images/infinite-planner-og.webp",
        width: 1200,
        height: 630,
        alt: "Infinite Planner",
      },
    ],
  },
  // Add Twitter card metadata
  twitter: {
    card: "summary_large_image",
    title: "Infinite Planner - The Flight Plan Hub for Infinite Flight",
    description: "The Flight Plan Hub for Infinite Flight.",
    images: ["/images/infinite-planner-og.webp"],
  },
  generator: "v0.dev",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${ibmPlexMono.variable} ${GeistSans.variable} ${funnelDisplay.variable} font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
          {/* Cookie consent banner - Google Analytics only loads after acceptance, see GoogleAnalytics */}
          <CookieConsentBanner />
        </ThemeProvider>
        <GoogleAnalytics />
        {/* Load Vercel Speed Insights for performance monitoring */}
        <SpeedInsights />
      </body>
    </html>
  )
}
