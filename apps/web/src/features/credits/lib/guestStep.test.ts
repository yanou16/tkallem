import { describe, expect, it } from "vitest";
import { guestStep } from "./guestStep";

describe("guestStep", () => {
  it("creates a guest when a visitor starts practising", () => {
    expect(guestStep(false, null, "/ai-chat")).toBe("create");
    expect(guestStep(false, null, "/practice")).toBe("create");
    expect(guestStep(false, null, "/plan")).toBe("create");
    expect(guestStep(false, null, "/groups")).toBe("create");
  });
  it("creates nobody on the welcome or sign-in pages", () => {
    expect(guestStep(false, null, "/welcome")).toBe("none");
    expect(guestStep(false, null, "/sign-in")).toBe("none");
  });
  it("keeps an existing guest", () => {
    expect(guestStep(false, "g1.token", "/ai-chat")).toBe("none");
  });
  it("brings the guest's credits to the account right after sign-in", () => {
    expect(guestStep(true, "g1.token", "/")).toBe("claim");
    expect(guestStep(true, null, "/")).toBe("none");
  });
});
