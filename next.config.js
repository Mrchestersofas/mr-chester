const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // seguimiento.mrchester.com.co abre directo la página de seguimiento de clientes
  async rewrites() {
    return {
      beforeFiles: [
        { source: '/', has: [{ type: 'host', value: 'seguimiento.mrchester.com.co' }], destination: '/seguimiento' },
      ],
    }
  },
}

module.exports = withPWA(nextConfig)
