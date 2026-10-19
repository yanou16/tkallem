"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

const DISMISSED_KEY = "tkallem-install-dismissed";
// Never over the chat input or the sign-in forms, and not in the first seconds of a visit.
const QUIET_PATHS = ["/ai-chat", "/sign-in", "/sign-up", "/sso-callback", "/forgot-password"];
const DELAY_MS = 20_000;

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false; // private mode, blocked storage
  }
}

/**
 * "Add to home screen" banner on phones. Chrome and Edge give us an install event; Safari on iPhone has none, so we
 * explain the Share menu. Nothing is shown once the app is installed, or after the student closed it once.
 * Shown after 20 s, and never on the chat or sign-in screens, where it would cover the input.
 */
export default function InstallPrompt() {
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [hidden, setHidden] = useState(true);
  const [waited, setWaited] = useState(false);
  const pathname = usePathname() ?? "";
  const pathnameRef = useRef(pathname);
  const waitedRef = useRef(waited);
  pathnameRef.current = pathname;
  waitedRef.current = waited;

  useEffect(() => {
    const t = window.setTimeout(() => setWaited(true), DELAY_MS);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);
    setIos(isIos);
    setHidden(!isIos);
    if (standalone || readDismissed()) return;
    const onPrompt = (e: Event) => {
      const mobile = window.matchMedia("(max-width: 767px)").matches;
      const quiet = QUIET_PATHS.some((p) => pathnameRef.current.startsWith(p));
      if (!mobile || quiet || !waitedRef.current) return;
      e.preventDefault();
      setEvent(e as InstallEvent);
      setHidden(false);
    };
    const onInstalled = () => setHidden(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (hidden || !waited || QUIET_PATHS.some((p) => pathname.startsWith(p))) return null;

  const close = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      /* ignore */
    }
    setHidden(true);
  };
  const install = async () => {
    if (!event) return;
    await event.prompt();
    const { outcome } = await event.userChoice;
    if (outcome === "accepted") setHidden(true);
    setEvent(null);
  };

  return (
    <div role="region" aria-label="Install the app" className="fixed inset-x-3 bottom-20 z-50 flex items-center gap-3 rounded-2xl border border-line bg-white p-3 shadow-lg md:hidden">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand text-lg font-extrabold text-ink" aria-hidden>T</div>
      <p className="min-w-0 flex-1 text-sm text-ink">
        {ios ? "Install Tkallem: tap Share, then “Add to Home Screen”." : "Install Tkallem on your phone for quick practice."}
      </p>
      {!ios && (
        <button onClick={install} className="shrink-0 rounded-full bg-ink px-4 py-2 text-sm font-medium text-white">Install</button>
      )}
      <button onClick={close} aria-label="Close" className="shrink-0 px-2 text-xl leading-none text-muted">×</button>
    </div>
  );
}
