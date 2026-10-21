import { describe, expect, it } from "vitest";
import { isActive } from "./AppShell";

describe("isActive", () => {
  it("matches Home only on /", () => {
    expect(isActive("/", "/")).toBe(true);
    expect(isActive("/practice", "/")).toBe(false);
  });
  it("keeps Practice lit on the list of situations and on the conversation", () => {
    expect(isActive("/practice", "/practice", ["/ai-chat"])).toBe(true);
    expect(isActive("/ai-chat", "/practice", ["/ai-chat"])).toBe(true);
    expect(isActive("/progress", "/practice", ["/ai-chat"])).toBe(false);
  });
  it("matches sub-routes and tolerates an unknown path", () => {
    expect(isActive("/phrases/3", "/phrases")).toBe(true);
    expect(isActive(null, "/phrases")).toBe(false);
  });
});
