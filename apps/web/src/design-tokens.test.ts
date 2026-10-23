import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Guards the rules of docs/DESIGN.md that a refactor could silently break: no violet, only the allowed colors,
 *  weights 400/500/600, shadows only on menus and dialogs. Reads the source, no browser. */
const SRC = join(__dirname);
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return files(p);
    return /\.(tsx|ts|css)$/.test(n) && !/\.test\./.test(n) ? [p] : [];
  });
}
const SOURCES = files(SRC).map((p) => ({ path: p.slice(SRC.length + 1), text: readFileSync(p, "utf8") }));
const offenders = (re: RegExp, allow: RegExp = /$^/) =>
  SOURCES.filter((f) => !allow.test(f.path)).flatMap((f) => (f.text.match(re) ?? []).map((m) => `${f.path}: ${m}`));

describe("design tokens (docs/DESIGN.md)", () => {
  it("has no violet (the soft pastels mint, butter, peach, rose and lilac are tokens of the new front)", () => {
    expect(offenders(/#6d4ee3|#e7e0fb|#e8e2fb|#d0c6f5/gi)).toEqual([]);
  });
  it("keeps the brand yellow to the logo mark, the microphone ring and the PWA theme", () => {
    const uses = offenders(/bg-brand\b|#ffd02f/gi, /^(app\/(globals\.css|layout\.tsx|manifest\.ts)|features\/landing\/ProductTour\.tsx)$/i);
    // Every other use must be a logo mark: a square "T" tile.
    for (const u of uses) expect(u).toMatch(/bg-brand/);
    const logoFiles = SOURCES.filter((f) => /bg-brand\b/.test(f.text)).map((f) => f.path).sort();
    expect(logoFiles).toEqual(["app/welcome/page.tsx", "components/AppShell.tsx", "components/InstallPrompt.tsx", "components/auth/AuthShell.tsx", "features/landing/PlatformPages.tsx"]);
  });
  it("uses no font weight under 400 or over 800", () => {
    expect(offenders(/\bfont-(thin|extralight|light|black)\b/g)).toEqual([]);
  });
  it("puts shadows only on menus, dialogs and the install banner", () => {
    const found = offenders(/\bshadow-(pop|sm|md|lg|xl|2xl)\b/g); // shadow-soft (cards) is part of the new front
    const allowed = /^(app\/globals\.css|app\/\(app\)\/ai-chat\/page\.tsx|components\/(AppShell|InstallPrompt|ui)\.tsx):/;
    expect(found.filter((f) => !allowed.test(f))).toEqual([]);
  });
  it("has no hard-coded grey text or border colors that are not a token", () => {
    expect(offenders(/text-\[#(16161a|6b6b75|111111?|a1a1aa)\]|placeholder:text-\[#/gi)).toEqual([]);
  });
});
