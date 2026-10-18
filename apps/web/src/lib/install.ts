/**
 * "Install the app" (PWA). Chrome and Edge fire `beforeinstallprompt` once per page load when the site is installable:
 * it is kept here (captured by PwaRegister at start) so any screen can offer the install later. Safari on iPhone has
 * no such event: the student uses Share > Add to Home Screen, which we explain.
 */
export type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
export type Platform = "installed" | "ios-safari" | "ios-other" | "other";

let deferred: InstallEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export const installStore = {
  capture(e: Event) {
    e.preventDefault(); // we show our own button instead of Chrome's mini-infobar, at a better moment
    deferred = e as InstallEvent;
    notify();
  },
  installed() {
    deferred = null;
    notify();
  },
  get: () => deferred,
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  async prompt(): Promise<"accepted" | "dismissed" | "unavailable"> {
    if (!deferred) return "unavailable";
    const e = deferred;
    await e.prompt();
    const { outcome } = await e.userChoice;
    deferred = null; // the event can be used once
    notify();
    return outcome;
  },
};

/** Where we are, from the user agent and the display mode (pure: tested). */
export function platformFrom(userAgent: string, standalone: boolean): Platform {
  if (standalone) return "installed";
  const ios = /iphone|ipad|ipod/i.test(userAgent);
  if (!ios) return "other";
  return /crios|fxios|edgios/i.test(userAgent) ? "ios-other" : "ios-safari";
}

/** Install help the screen can show: a real install button, the iPhone hint, or nothing. */
export function installOffer(platform: Platform, hasEvent: boolean): "button" | "ios-hint" | "none" {
  if (platform === "installed") return "none";
  if (hasEvent) return "button";
  return platform === "ios-safari" ? "ios-hint" : "none";
}

// Never over the chat input or the sign-in forms, and not in the very first seconds of a visit.
export const QUIET_PATHS = ["/ai-chat", "/sign-in", "/sign-up", "/sso-callback", "/forgot-password"];
export const BANNER_DELAY_MS = 8_000;

export function showBanner(path: string, waited: boolean, dismissed: boolean, offer: ReturnType<typeof installOffer>): boolean {
  return offer !== "none" && waited && !dismissed && !QUIET_PATHS.some((p) => path.startsWith(p));
}
