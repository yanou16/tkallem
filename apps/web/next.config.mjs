/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }, { protocol: "http", hostname: "localhost" }] },
};

// The service worker must always be re-checked, otherwise a broken version could stay on phones for a day.
nextConfig.headers = async () => [
  {
    source: "/sw.js",
    headers: [
      { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
      { key: "Service-Worker-Allowed", value: "/" },
    ],
  },
];

export default nextConfig;
