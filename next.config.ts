import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
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
