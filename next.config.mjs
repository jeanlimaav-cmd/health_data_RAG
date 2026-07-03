/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdf-parse is a CommonJS Node library; keep it out of the bundler and load it at runtime.
  experimental: {
    serverComponentsExternalPackages: ["pdf-parse"],
  },
};

export default nextConfig;
