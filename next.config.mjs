/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'firebasestorage.googleapis.com' },
      { protocol: 'https', hostname: '**.firebasestorage.app' },
      { protocol: 'https', hostname: 'via.placeholder.com' },
    ],
  },
  webpack: (config) => {
    // Reduce disk usage during local builds
    config.cache = false;
    return config;
  },
};

export default nextConfig;
