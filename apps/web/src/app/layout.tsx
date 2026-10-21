import type { Metadata, Viewport } from "next";
import { Figtree } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import PwaRegister from "@/components/PwaRegister";
import InstallPrompt from "@/components/InstallPrompt";
import { Analytics } from "@vercel/analytics/next";

const font = Figtree({ // DESIGN.md: one family everywhere
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Tkallem",
  description: "Rehearse your interview in English: an AI coach that corrects every sentence and explains it in English or French.",
  applicationName: "Tkallem",
  appleWebApp: { capable: true, title: "Tkallem", statusBarStyle: "default" },
  icons: {
    icon: [{ url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" }, { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#FFD02F",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // the app draws under the iPhone notch: safe areas are handled in CSS
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={font.variable}>
      <body className="font-sans">
        <Providers>{children}</Providers>
        <PwaRegister />
        <InstallPrompt />
        <Analytics />
      </body>
    </html>
  );
}