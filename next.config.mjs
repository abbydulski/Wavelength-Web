/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // Reduce disk usage during local builds
    config.cache = false;
    return config;
  },
};

export default nextConfig;
