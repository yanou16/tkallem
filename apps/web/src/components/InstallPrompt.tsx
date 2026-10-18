"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { BANNER_DELAY_MS, showBanner } from "@/lib/install";
import { useInstall } from "@/features/pwa/useInstall";

const DISMISSED_KEY = "tkallem-install-dismissed";

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false; // private mode, blocked storage
  }
}

/**
 * Phone banner proposing to install the app, a few seconds into a visit, never over the chat or the sign-in forms
 * (lib/install.ts decides). Closed once, it stays closed; the "Install the app" buttons remain on the welcome page and
 * at the end of a session.
 */
export default function InstallPrompt() {
  const { offer, install } = useInstall();
  const pathname = usePathname() ?? "";
  const [waited, setWaited] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(readDismissed());
    const t = window.setTimeout(() => setWaited(true), BANNER_DELAY_MS);
    return () => window.clearTimeout(t);
  }, []);

  if (!showBanner(pathname, waited, dismissed, offer)) return null;

  const close = () => {
    try { localStorage.setItem(DISMISSED_KEY, "1"); } catch { /* ignore */ }
    setDismissed(true);
  };

  return (
    <div role="region" aria-label="Install the app" className="fixed inset-x-3 bottom-20 z-50 flex items-center gap-3 rounded-2xl border border-line bg-white p-3 shadow-lg md:hidden">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand text-lg font-semibold text-ink" aria-hidden>T</div>
      <p className="min-w-0 flex-1 text-sm text-ink">
        {offer === "ios-hint" ? "Install Tkallem: tap Share, then “Add to Home Screen”." : "Install Tkallem on your phone for quick practice."}
      </p>
      {offer === "button" && (
        <button onClick={async () => { if ((await install()) === "accepted") close(); }} className="shrink-0 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white">
          Install
        </button>
      )}
      <button onClick={close} aria-label="Close" className="shrink-0 px-1 text-xl leading-none text-muted">×</button>
    </div>
  );
}
