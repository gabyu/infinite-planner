/** @type {import('next').NextConfig} */
const nextConfig = {
  // Dynamic pages (the dashboard) are fetched again on every visit instead of reused from the browser's
  // router cache for 30 s: clicking "Dashboard" always shows the current list.
  experimental: { staleTimes: { dynamic: 0 } },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
 
  eslint: {
    ignoreDuringBuilds: true,
  },

  // The guide and the FAQ are one page now.
  async redirects() {
    return [
      { source: "/how-it-works", destination: "/help#how-it-works", permanent: true },
      { source: "/faq", destination: "/help#faq", permanent: true },
    ]
  },
}

export default nextConfig