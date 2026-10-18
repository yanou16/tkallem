import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import HowItWorks from "./HowItWorks";
import { HOW_STEPS, PRIVACY_LINE } from "./howSteps";

const publicFile = (src: string) => new URL(`../../../public${src}`, import.meta.url);
const pngSize = (src: string) => { const b = readFileSync(publicFile(src)); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }; };
const html = renderToStaticMarkup(createElement(HowItWorks, { ctaHref: "/ai-chat?scenarioId=visa-us", ctaLabel: "Try a visa interview now" }));

describe("How it works (landing)", () => {
  it("has four numbered steps, in order", () => {
    expect(HOW_STEPS.map((s) => s.n)).toEqual([1, 2, 3, 4]);
    expect(html.match(/<li /g)).toHaveLength(4);
    expect(html).toContain("<ol");
  });

  it("keeps each step line short (8 words at most) and in US English", () => {
    for (const s of HOW_STEPS) expect(s.line.trim().split(/\s+/).length).toBeLessThanOrEqual(8);
    expect(HOW_STEPS.map((s) => s.line).join(" ")).not.toMatch(/practise|colour|organis/i);
  });

  it("shows a real picture for every step: file exists, real pixel size, alt text, no icon tile", () => {
    for (const s of HOW_STEPS) {
      expect(pngSize(s.src)).toEqual({ w: s.w, h: s.h });
      expect(s.alt.length).toBeGreaterThan(20);
    }
    expect(html.match(/<img /g)).toHaveLength(4);
    expect(html.match(/ alt="[^"]{20,}"/g)).toHaveLength(4);
    expect(html).toMatch(/width="780"/);
    expect(html).not.toMatch(/<svg[^>]*lucide-(mic|check|target)/); // pictures, not icons
  });

  it("brings the main call to action back, with a 44px target, and states the audio rule", () => {
    const cta = html.match(/<a [^>]*href="\/ai-chat\?scenarioId=visa-us"[^>]*>/)?.[0] ?? "";
    expect(cta).toContain("min-h-12");
    expect(html).toContain("Try a visa interview now");
    expect(html).toContain(PRIVACY_LINE);
    expect(PRIVACY_LINE).toBe("We never store your audio. Only text.");
  });

  it("is a labelled section the menu link can reach (#how)", () => {
    expect(html).toContain('id="how"');
    expect(html).toContain('aria-labelledby="how-title"');
  });
});
