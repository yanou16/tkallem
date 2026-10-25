"use client";
import type { ReactNode } from "react";
import { PhoneCall, PhoneOff } from "lucide-react";
import { cn } from "@/lib/utils";

/** Visual-only shell, shared by the real call and the welcome demonstration. */
export function VoiceCoachView({ avatar, status, children, subtitle }: { avatar: ReactNode; status: ReactNode; children: ReactNode; subtitle?: string }) {
  return <div className="mx-auto flex w-full max-w-lg flex-col items-center text-center">
    {avatar}
    <h2 className="mt-4 text-xl font-bold sm:mt-5">Your AI tutor</h2>
    {subtitle && <p className="text-sm text-slate">{subtitle}</p>}
    <div className="mt-2 min-h-7 text-base font-medium text-ink">{status}</div>
    {children}
  </div>;
}

export function VoiceCallButton({ active = false, connecting = false, disabled, onClick }: { active?: boolean; connecting?: boolean; disabled?: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} disabled={disabled}
    className={cn("inline-flex min-h-14 w-full max-w-xs items-center justify-center gap-3 rounded-full px-7 py-4 text-base font-semibold transition-[background-color,transform] active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink disabled:opacity-40", active ? "bg-rose text-ink hover:bg-rose-deep" : connecting ? "border-2 border-ink bg-white text-ink hover:bg-black/5" : "bg-ink text-white hover:bg-black/80")}>
    {active || connecting ? <PhoneOff size={22} aria-hidden="true" /> : <PhoneCall size={22} aria-hidden="true" />}
    {connecting ? "Cancel" : active ? "End call" : "Start voice call"}
  </button>;
}
