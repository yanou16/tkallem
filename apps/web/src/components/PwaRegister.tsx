"use client";

import { useEffect } from "react";

/** Registers the service worker (production only: in development a cached page would hide your changes). */
export default function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      /* the app works without it */
    });
  }, []);
  return null;
}
