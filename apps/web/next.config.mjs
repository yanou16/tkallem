/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }, { protocol: "http", hostname: "localhost" }] },
};

// Basic browser protections. Microphone stays allowed for this site (the whole product is speaking); camera and location are not used.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "microphone=(self), camera=(), geolocation=(), payment=()" },
];

// The service worker must always be re-checked, otherwise a broken version could stay on phones for a day.
nextConfig.headers = async () => [
  { source: "/:path*", headers: securityHeaders },
  {
    source: "/sw.js",
    headers: [
      { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
      { key: "Service-Worker-Allowed", value: "/" },
    ],
  },
];

export default nextConfig;
