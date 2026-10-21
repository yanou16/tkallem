"use client";
import type { ReactNode } from "react";
import { PhoneCall, PhoneOff } from "lucide-react";
import { cn } from "@/lib/utils";

/** Visual-only shell, shared by the real call and the welcome demonstration. */
export function VoiceCoachView({ avatar, status, children }: { avatar: ReactNode; status: ReactNode; children: ReactNode }) {
  return <div className="mx-auto flex max-w-lg flex-col items-center text-center">
    {avatar}
    <h2 className="mt-5 text-xl font-bold">Your AI tutor</h2>
    <div role="status" className="mt-2 text-sm text-muted">{status}</div>
    {children}
  </div>;
}

export function VoiceCallButton({ active = false, connecting = false, disabled, onClick }: { active?: boolean; connecting?: boolean; disabled?: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} disabled={disabled}
    className={cn("inline-flex min-h-14 w-full max-w-xs items-center justify-center gap-3 rounded-full px-7 py-4 text-base font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink disabled:opacity-40", active || connecting ? "bg-rose text-ink hover:bg-rose-deep" : "bg-ink text-white hover:bg-black/80")}>
    {active || connecting ? <PhoneOff size={22} aria-hidden="true" /> : <PhoneCall size={22} aria-hidden="true" />}
    {connecting ? "Cancel connection" : active ? "End call" : "Start voice call"}
  </button>;
}
