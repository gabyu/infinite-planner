/** @type {import('next').NextConfig} */
const nextConfig = {
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