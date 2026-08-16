/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Playwright se ejecuta en el servidor tal cual (sin empaquetar con webpack).
    serverComponentsExternalPackages: ["playwright", "playwright-core"],
  },
};

export default nextConfig;
