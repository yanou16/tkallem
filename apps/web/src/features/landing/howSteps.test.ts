import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import HowItWorks from "./HowItWorks";
import { HOW_STEPS, PRIVACY_LINE } from "./howSteps";

const html = renderToStaticMarkup(createElement(HowItWorks, { ctaHref: "/ai-chat?scenarioId=visa-us", ctaLabel: "Try a visa interview now" }));

describe("How it works (landing)", () => {
  it("has four numbered steps, in order", () => {
    expect(HOW_STEPS.map((s) => s.n)).toEqual([1, 2, 3, 4]);
    expect(HOW_STEPS).toHaveLength(4);
    expect(html).toContain("<ol");
  });

  it("keeps each step line short (8 words at most) and in US English", () => {
    for (const s of HOW_STEPS) expect(s.line.trim().split(/\s+/).length).toBeLessThanOrEqual(8);
    expect(HOW_STEPS.map((s) => s.line).join(" ")).not.toMatch(/practise|colour|organis/i);
  });

  it("renders UI previews instead of screenshots", () => {
    expect(html).not.toContain("<img");
    expect(html).toContain("Visa interview");
    expect(html).toContain("Yesterday I went to the park.");
    expect(html).toContain("Go has an irregular past tense");
    expect(html).not.toContain("/landing/how-");
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
