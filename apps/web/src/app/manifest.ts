import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tkallem",
    short_name: "Tkallem",
    description: "Practice the English conversations that matter, without fear of mistakes.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "en",
    categories: ["education"],
    background_color: "#ffffff",
    theme_color: "#FFD02F",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [{ name: "Practice", short_name: "Practice", url: "/practice", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] }],
  };
}
