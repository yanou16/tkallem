import type { Config } from "tailwindcss";
import preset from "./tailwind.preset";

const config: Config = {
  // DESIGN.md tokens (canvas, surface, ink, charcoal, slate, steel, stone, hairline, tint-*, good/warn/bad, type scale).
  presets: [preset as Config],
  content: ["./src/**/*.{ts,tsx}"],
  // On phones a tap would otherwise leave `hover:` styles stuck on the tapped control.
  future: { hoverOnlyWhenSupported: true },
  theme: {
    extend: {
      fontFamily: { sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"] },
      colors: {
        // Aliases of docs/DESIGN.md tokens (no colors of their own): muted text is steel, borders are hairline.
        muted: "var(--steel)",
        line: "var(--hairline)",
        brand: "#FFD02F", // logo mark only (and the mic ring, the PWA theme)
        // Soft pastels of the new front: cards, illustrations, stat tiles.
        mint: { DEFAULT: "#D3F6F0", deep: "#A8EADF" },
        butter: { DEFAULT: "#FFF0BF", deep: "#FFE08A" },
        peach: { DEFAULT: "#FFE5CF", deep: "#FFCDA3" },
        rose: { DEFAULT: "#FFD9DD", deep: "#FFB8C0" },
        lilac: { DEFAULT: "#E8E2FB", deep: "#D0C6F5" },
        success: "#1DB87E",
      },
      borderRadius: { card: "var(--radius-card)" },
      // The only shadow of the design system, for menus and dialogs.
      boxShadow: { soft: "var(--shadow-pop)" },
    },
  },
  plugins: [],
};
export default config;
