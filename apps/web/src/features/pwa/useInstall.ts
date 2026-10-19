"use client";
import { useEffect, useState } from "react";
import { installOffer, installStore, platformFrom, type Platform } from "@/lib/install";

/** What install help this device can get right now, and the action for the install button. */
export function useInstall() {
  const [platform, setPlatform] = useState<Platform>("other");
  const [hasEvent, setHasEvent] = useState(false);
  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
    setPlatform(platformFrom(navigator.userAgent, standalone));
    const sync = () => setHasEvent(installStore.get() !== null);
    sync();
    const off = installStore.subscribe(sync);
    return () => { off(); };
  }, []);
  return { offer: installOffer(platform, hasEvent), install: () => installStore.prompt() };
}
