import { afterEach, describe, expect, it, vi } from "vitest";

/** features.ts reads the variable when it is loaded: load it again for each value. */
async function groupsWith(value: string | undefined) {
  vi.stubEnv("NEXT_PUBLIC_FEATURE_GROUPS", value);
  vi.resetModules();
  return (await import("./features")).FEATURES.groups;
}

afterEach(() => vi.unstubAllEnvs());

describe("FEATURES.groups", () => {
  it("is off without the variable: no menu link, /groups redirects (docs/JURY_BRIEF.md F-4)", async () => {
    expect(await groupsWith(undefined)).toBe(false);
  });

  it("is on with NEXT_PUBLIC_FEATURE_GROUPS=1", async () => {
    expect(await groupsWith("1")).toBe(true);
  });

  it("stays off for any other value", async () => {
    for (const value of ["", "0", "true", "yes", " 1"]) expect(await groupsWith(value)).toBe(false);
  });
});
