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
        hostname: 'your-strapi-domain.com', // Replace with your production Strapi domain
        pathname: '/uploads/**',
      },
    ],
  },
};

export default nextConfig;
