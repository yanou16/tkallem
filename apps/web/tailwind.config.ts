import type { Config } from "tailwindcss";
import preset from "./tailwind.preset";

const config: Config = {
  presets: [preset as Config],
  content: ["./src/**/*.{ts,tsx}"],
};

export default config;
