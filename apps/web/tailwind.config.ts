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
      },
      borderRadius: { card: "var(--radius-card)" },
      // The only shadow of the design system, for menus and dialogs.
      boxShadow: { soft: "var(--shadow-pop)" },
    },
  },
  plugins: [],
};
export default config;
