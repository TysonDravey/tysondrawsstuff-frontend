import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export', // Enable static export
  trailingSlash: true, // Required for static export
  images: {
    unoptimized: true, // Required for static export
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '1339',
        pathname: '/uploads/**',
      },
      {
        protocol: 'https',
        hostname: 'loose-stake-distributor-are.trycloudflare.com',
        pathname: '/uploads/**',
      },
      {
        protocol: 'https',
        hostname: '*.trycloudflare.com', // Allow any Cloudflare tunnel
        pathname: '/uploads/**',
      },
    ],
  },
};

export default nextConfig;
