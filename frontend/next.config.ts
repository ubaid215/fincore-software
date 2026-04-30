import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',

  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:4000/v1/:path*',
      },
    ]
  },

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.fincore.app' },
      { protocol: 'https', hostname: 's3.amazonaws.com' },
    ],
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options',       value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy',        value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy',     value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },

  webpack(config) {
    config.module.rules.push({ test: /\.svg$/, use: ['@svgr/webpack'] })
    return config
  },
}

export default nextConfig