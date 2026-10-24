import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// pr-94 intentionally uses pastel cards and bold headings. Guard readability
// instead of enforcing main's former ban on those user-approved styles.
const config = readFileSync(join(__dirname, "../tailwind.config.ts"), "utf8");
function luminance(hex: string) {
  const channels = hex.replace("#", "").match(/../g)!.map((part) => {
    const value = parseInt(part, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
const ink = config.match(/ink: "(#[0-9a-f]+)"/i)![1];
describe("pr-94 pastel card readability", () => {
  for (const tone of ["mint", "butter", "peach", "rose", "lilac"]) {
    it(`keeps normal ink text readable on ${tone} cards`, () => {
      const background = config.match(new RegExp(`${tone}: \{ DEFAULT: "(#[0-9a-f]+)"`, "i"))![1];
      expect((luminance(background) + 0.05) / (luminance(ink) + 0.05)).toBeGreaterThanOrEqual(4.5);
    });
  }
});
