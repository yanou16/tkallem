import { describe, expect, it } from "vitest";
import { GUEST_PATHS, isPublicPath } from "./publicRoutes";

describe("what a visitor without an account may open", () => {
  it("every screen of the guest menu is a public route (the middleware would otherwise send the guest to sign in)", () => {
    for (const path of GUEST_PATHS) expect(isPublicPath(path), path).toBe(true);
  });

  it("the guest menu holds Practice, Progress and Groups, and not Home or Profile", () => {
    expect([...GUEST_PATHS].sort()).toEqual(["/groups", "/practice", "/progress"]);
  });

  it("opens Progress and its sub-pages, the practice flow and sign-in", () => {
    for (const path of ["/progress", "/progress/anything", "/practice", "/ai-chat", "/plan", "/welcome", "/sign-in", "/sign-up/verify"])
      expect(isPublicPath(path), path).toBe(true);
  });

  it("keeps Home and Profile for signed-in students, and does not match look-alike paths", () => {
    for (const path of ["/", "/profile", "/progressive", "/practice-room", "/welcome/extra"]) expect(isPublicPath(path), path).toBe(false);
  });
});
