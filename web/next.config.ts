import type { NextConfig } from "next";

// Server-side only: how the Next.js server reaches the API container directly
// (not through the host-mapped port), used to proxy /uploads/* below.
const internalApiUrl = process.env.INTERNAL_API_URL ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/uploads/:path*",
        destination: `${internalApiUrl}/uploads/:path*`,
      },
    ];
  },
};

export default nextConfig;
