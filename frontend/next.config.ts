import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
    typedRoutes: true,
  
 
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.fincore.app',
      },
      {
        protocol: 'https',
        hostname: 's3.amazonaws.com',
      },
    ],
  },
 
  // Strict CSP headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options',           value: 'DENY' },
          { key: 'X-Content-Type-Options',     value: 'nosniff' },
          { key: 'Referrer-Policy',            value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy',         value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'X-DNS-Prefetch-Control',     value: 'on' },
        ],
      },
    ]
  },
 
  // Redirect bare dashboard root → org picker
  async redirects() {
    return [
      {
        source: '/dashboard',
        destination: '/dashboard/select',
        permanent: false,
      },
    ]
  },
 
  webpack(config) {
    config.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack'],
    })
    return config
  },
};

export default nextConfig;
