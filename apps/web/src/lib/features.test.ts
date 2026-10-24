import { describe, expect, it } from "vitest";
import { FEATURES } from "./features";

describe("available product features", () => {
  it("keeps the working practice groups enabled", () => {
    expect(FEATURES.groups).toBe(true);
  });
  it("does not expose unfinished notifications", () => {
    expect(FEATURES.notifications).toBe(false);
  });
});
