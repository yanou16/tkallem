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

// The practice groups were removed from the app: an old bookmark or link goes to Practice instead of a 404.
nextConfig.redirects = async () => [{ source: "/groups/:path*", destination: "/practice", permanent: false }];

export default nextConfig;
