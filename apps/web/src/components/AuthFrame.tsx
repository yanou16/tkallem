import type { ReactNode } from "react";
export function AuthFrame({ left, children }: { left: ReactNode; children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#faf9f4] p-6">
      <div aria-hidden className="pointer-events-none absolute -bottom-24 right-10 h-[420px] w-[420px] rounded-full bg-butter-deep/60 blur-sm" />
      <div aria-hidden className="pointer-events-none absolute -left-20 top-40 h-[360px] w-[360px] rounded-full bg-mint/70" />
      <div className="relative grid w-full max-w-6xl items-center gap-12 md:grid-cols-[1fr_460px]">
        <div>
          <div className="mb-14 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-lg font-extrabold">T</span>
            <span className="text-2xl font-bold">Tkallem</span>
          </div>
          {left}
        </div>
        <div className="rounded-[28px] border border-line bg-white p-8 shadow-soft">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, hint, ...p }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className="block text-sm font-medium">
      {label} {hint && <span className="font-normal text-muted">({hint})</span>}
      <input {...p} className="mt-1.5 w-full rounded-xl border border-line bg-white px-4 py-3 text-[15px] font-normal outline-none placeholder:text-black/30 focus:border-ink" />
    </label>
  );
}
