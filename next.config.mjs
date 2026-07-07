/** @type {import('next').NextConfig} */
const nextConfig = {
  // Emit the build into `dist/` instead of the default `.next/`.
  // NOTE: on Vercel, set Settings > Build & Deployment > Output Directory to `dist`.
  // distDir: "dist",
  // pdf-parse is a CommonJS Node library; keep it out of the bundler and load it at runtime.
  experimental: {
    serverComponentsExternalPackages: ["pdf-parse"],
  },
};

export default nextConfig;
