/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'snowflake-sdk'],
  },
}

module.exports = nextConfig
