// Tkallem Tailwind preset. Usage in tailwind.config.ts: presets: [require("./tailwind.preset")]
import type { Config } from "tailwindcss";

const preset: Partial<Config> = {
  theme: {
    extend: {
      colors: {
        canvas: "var(--canvas)",
        surface: "var(--surface)",
        ink: "var(--ink)",
        charcoal: "var(--charcoal)",
        slate: "var(--slate)",
        steel: "var(--steel)",
        stone: "var(--stone)",
        hairline: { DEFAULT: "var(--hairline)", soft: "var(--hairline-soft)", strong: "var(--hairline-strong)" },
        "brand-yellow": "var(--brand-yellow)",
        tint: { visa: "var(--tint-visa)", campus: "var(--tint-campus)", job: "var(--tint-job)", ielts: "var(--tint-ielts)" },
        good: { DEFAULT: "var(--good)", bg: "var(--good-bg)", fill: "var(--good-fill)" },
        warn: { DEFAULT: "var(--warn)", bg: "var(--warn-bg)" },
        bad: { DEFAULT: "var(--bad)", bg: "var(--bad-bg)" },
      },
      fontFamily: { sans: ["var(--font-sans)"] },
      fontSize: {
        display: ["48px", { lineHeight: "1.15", letterSpacing: "-1px", fontWeight: "500" }],
        h2: ["36px", { lineHeight: "1.2", fontWeight: "500" }],
        h3: ["28px", { lineHeight: "1.25", fontWeight: "500" }],
        h4: ["22px", { lineHeight: "1.3", fontWeight: "500" }],
        h5: ["18px", { lineHeight: "1.4", fontWeight: "500" }],
        body: ["16px", { lineHeight: "1.5" }],
        small: ["14px", { lineHeight: "1.5" }],
        caption: ["13px", { lineHeight: "1.4", fontWeight: "600" }],
        stat: ["64px", { lineHeight: "1.05", letterSpacing: "-1.5px", fontWeight: "500" }],
      },
      borderRadius: {
        input: "var(--radius-input)",
        panel: "var(--radius-panel)",
        correction: "var(--radius-correction)",
        bubble: "var(--radius-bubble)",
        card: "var(--radius-card)",
      },
      boxShadow: { pop: "var(--shadow-pop)" },
    },
  },
};

export default preset;
