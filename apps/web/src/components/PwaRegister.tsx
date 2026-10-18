"use client";

import { useEffect } from "react";
import { installStore } from "@/lib/install";

/** Registers the service worker (production only: in development a cached page would hide your changes), and keeps
 *  the browser's install event for the "Install the app" buttons (lib/install.ts). */
export default function PwaRegister() {
  useEffect(() => {
    const onPrompt = (e: Event) => installStore.capture(e);
    const onInstalled = () => installStore.installed();
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        /* the app works without it */
      });
    }
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  return null;
}
