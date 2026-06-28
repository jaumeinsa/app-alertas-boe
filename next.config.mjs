/** @type {import('next').NextConfig} */
const nextConfig = {
  // Build a self-contained server bundle so it runs on the Hostinger VPS
  // without needing the full node_modules tree (great for Docker).
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // Allow the worker scripts to import server-only modules cleanly.
    serverComponentsExternalPackages: ["@prisma/client", "prisma"],
  },
};

export default nextConfig;
