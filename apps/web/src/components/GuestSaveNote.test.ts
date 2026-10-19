import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import GuestSaveNote, { GUEST_SAVE_TEXT } from "./GuestSaveNote";

describe("GuestSaveNote", () => {
  const html = renderToStaticMarkup(createElement(GuestSaveNote));

  it("says the report is kept on this device and how to keep it everywhere", () => {
    expect(GUEST_SAVE_TEXT).toBe("Saved on this device. Create an account to keep it on any device.");
    expect(html).toContain(GUEST_SAVE_TEXT);
  });

  it("links to sign-up with a 44 px target", () => {
    const link = html.match(/<a [^>]*>/)?.[0] ?? "";
    expect(link).toContain('href="/sign-up"');
    expect(link).toContain("min-h-11");
  });

  it("uses design tokens only (no shadow, no tint)", () => {
    expect(html).not.toMatch(/shadow|bg-(mint|butter|peach|rose|lilac)|violet/);
  });
});
