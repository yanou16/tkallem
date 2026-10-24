import type { Config } from "tailwindcss";
import preset from "./tailwind.preset";

const config: Config = {
  // Keep this front's overrides while generating the semantic styles used by the live group components.
  presets: [preset as Config],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"] },
      colors: {
        ink: "#111111",
        muted: "#6b6b76",
        line: "#ececf0",
        brand: "#FFD02F",
        mint: { DEFAULT: "#D3F6F0", deep: "#A8EADF" },
        butter: { DEFAULT: "#FFF0BF", deep: "#FFE08A" },
        peach: { DEFAULT: "#FFE5CF", deep: "#FFCDA3" },
        rose: { DEFAULT: "#FFD9DD", deep: "#FFB8C0" },
        lilac: { DEFAULT: "#E8E2FB", deep: "#D0C6F5" },
        success: "#1DB87E",
      },
      borderRadius: { card: "22px" },
      boxShadow: { soft: "0 1px 2px rgba(17,17,17,.04), 0 8px 24px rgba(17,17,17,.04)" },
    },
  },
  plugins: [],
};
export default config;
