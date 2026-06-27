import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Vercel detecta Next.js automaticamente */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
