import { describe, expect, it } from "vitest";
import { installOffer, platformFrom, showBanner } from "./install";

const IPHONE_SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0 Mobile/15E148 Safari/604.1";
const ANDROID_CHROME = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36";

describe("platformFrom", () => {
  it("tells installed apps, iPhone Safari, other iPhone browsers and the rest apart", () => {
    expect(platformFrom(ANDROID_CHROME, true)).toBe("installed");
    expect(platformFrom(IPHONE_SAFARI, false)).toBe("ios-safari");
    expect(platformFrom(IPHONE_CHROME, false)).toBe("ios-other");
    expect(platformFrom(ANDROID_CHROME, false)).toBe("other");
  });
});

describe("installOffer", () => {
  it("offers the real install when the browser gave us its event", () => {
    expect(installOffer("other", true)).toBe("button");
  });
  it("explains Share > Add to Home Screen on iPhone Safari only", () => {
    expect(installOffer("ios-safari", false)).toBe("ios-hint");
    expect(installOffer("ios-other", false)).toBe("none"); // Chrome on iPhone cannot install
  });
  it("offers nothing once installed, or when the browser cannot install (private window)", () => {
    expect(installOffer("installed", true)).toBe("none");
    expect(installOffer("other", false)).toBe("none");
  });
});

describe("showBanner", () => {
  it("never covers the chat input or the sign-in forms", () => {
    expect(showBanner("/ai-chat", true, false, "button")).toBe(false);
    expect(showBanner("/sign-in", true, false, "button")).toBe(false);
  });
  it("waits a few seconds, and stays closed once dismissed", () => {
    expect(showBanner("/welcome", false, false, "button")).toBe(false);
    expect(showBanner("/welcome", true, true, "button")).toBe(false);
    expect(showBanner("/welcome", true, false, "button")).toBe(true);
    expect(showBanner("/practice", true, false, "ios-hint")).toBe(true);
  });
});
