import { afterEach, describe, expect, it, vi } from "vitest";

/** features.ts reads the variable when it is loaded: load it again for each value. */
async function groupsWith(value: string | undefined) {
  vi.stubEnv("NEXT_PUBLIC_FEATURE_GROUPS", value);
  vi.resetModules();
  return (await import("./features")).FEATURES.groups;
}

afterEach(() => vi.unstubAllEnvs());

describe("FEATURES.groups", () => {
  it("is on without the variable: the menu link and /groups are there", async () => {
    expect(await groupsWith(undefined)).toBe(true);
    expect(await groupsWith("1")).toBe(true);
  });

  it("is off only with NEXT_PUBLIC_FEATURE_GROUPS=0", async () => {
    expect(await groupsWith("0")).toBe(false);
  });
});
