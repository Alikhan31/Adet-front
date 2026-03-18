/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async rewrites() {
    // NOTE: rewrites are computed at build-time for production builds.
    // For Docker builds, pass this via build args (see Dockerfile/docker-compose.yml).
    const apiBase = (
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      process.env.API_BASE_URL ||
      ""
    ).replace(/\/+$/, "")
    if (!apiBase) return []
    return [
      {
        source: "/api/:path*",
        destination: `${apiBase}/api/:path*`,
      },
    ]
  },
}

export default nextConfig
