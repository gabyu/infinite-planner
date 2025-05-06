import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Infinite Planner - Flight Plan Converter for Infinite Flight",
  description:
    "Turn real-world flights into Infinite Flight custom flight plans! Import KML files from FlightRadar24 or FlightAware and export to Infinite Flight.",
  icons: {
    icon: "/favicon.svg",
    apple: "/favicon.svg",
  },
  // Add OpenGraph metadata for social media sharing
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://infinite-planner.vercel.app/",
    title: "Infinite Planner - Flight Plan Converter for Infinite Flight",
    description: "Turn real-world flights into Infinite Flight custom flight plans!",
    siteName: "Infinite Planner",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Infinite Planner",
      },
    ],
  },
  // Add Twitter card metadata
  twitter: {
    card: "summary_large_image",
    title: "Infinite Planner - Flight Plan Converter for Infinite Flight",
    description: "Turn real-world flights into Infinite Flight custom flight plans!",
    images: ["/og-image.png"],
  },
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
