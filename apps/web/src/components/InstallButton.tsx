"use client";
import { Download, Share } from "lucide-react";
import { useInstall } from "@/features/pwa/useInstall";
import { cn } from "@/lib/utils";

/** "Install the app" where it helps (welcome page, end of a session). Nothing when the device cannot install. */
export default function InstallButton({ className }: { className?: string }) {
  const { offer, install } = useInstall();
  if (offer === "none") return null;
  if (offer === "ios-hint") {
    return (
      <p className={cn("flex items-center gap-2 text-sm text-muted", className)}>
        <Share size={16} aria-hidden /> Install it on your iPhone: tap Share, then “Add to Home Screen”.
      </p>
    );
  }
  return (
    <button onClick={() => install()} className={cn("inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm font-semibold", className)}>
      <Download size={16} aria-hidden /> Install the app
    </button>
  );
}
