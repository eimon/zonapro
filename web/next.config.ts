import type { NextConfig } from "next";

// Destino del proxy de /uploads/* (ver rewrites). Con output:standalone los
// rewrites se congelan en build time, así que el destino debe ser una URL
// alcanzable EN RUNTIME. INTERNAL_API_URL (nombre de red interno) no resuelve
// durante `docker build`; por eso caemos a NEXT_PUBLIC_API_URL (URL pública),
// que es válida tanto en build como en runtime.
const internalApiUrl =
  process.env.INTERNAL_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8000";

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
