import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/** Unit tests for the API layer (mappers, error handling): plain functions, no browser needed. */
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
