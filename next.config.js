/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  outputFileTracingIncludes: {
    '/api/clash': ['./templates/MetaCubeX_Full.ini'],
    '/api/preview-template': ['./templates/MetaCubeX_Full.ini'],
  },

  async headers() {
    return [
      {
        // Tell crawlers not to index anything on this self-hosted tool
        source: '/(.*)',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
