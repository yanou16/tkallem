"use client";

import { useState, type InputHTMLAttributes, type ReactNode } from "react";

/* ------------------------------------------------------------------ */
/* Petits éléments partagés                                            */
/* ------------------------------------------------------------------ */

export function Avatar({
  skin = "#f1c9a5",
  hair = "#2b2220",
  bg = "#f7d9a8",
  size = 40,
  long = false,
}: {
  skin?: string;
  hair?: string;
  bg?: string;
  size?: number;
  long?: boolean;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className="shrink-0 rounded-full" aria-hidden>
      <rect width="40" height="40" fill={bg} />
      {long && <path d="M9 40V20c0-8 5-13 11-13s11 5 11 13v20z" fill={hair} />}
      <path d="M6 40c1-8 7-11 14-11s13 3 14 11z" fill="#3d4a6b" />
      <circle cx="20" cy="18" r="7.5" fill={skin} />
      <path d="M12.3 17c0-5.5 3.4-8.5 7.7-8.5s7.7 3 7.7 8.5c-2-2-4.5-3.2-7.7-3.2S14.3 15 12.3 17z" fill={hair} />
    </svg>
  );
}

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
      {off && <path d="M4 4l16 16" />}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Champ de formulaire                                                 */
/* ------------------------------------------------------------------ */

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  password?: boolean;
};

export function AuthField({ label, hint, password, id, className = "", ...props }: FieldProps) {
  const [shown, setShown] = useState(false);
  const fieldId = id ?? label.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className={className}>
      <label htmlFor={fieldId} className="mb-1.5 block text-[13px] font-medium text-[#16161a]">
        {label}
        {hint && <span className="ml-1 text-[11px] font-normal text-[#8a8a93]">({hint})</span>}
      </label>
      <div className="relative">
        <input
          id={fieldId}
          {...props}
          type={password ? (shown ? "text" : "password") : props.type}
          className={`h-11 w-full rounded-lg border border-[#e4e4e7] bg-white px-3.5 text-[14px] text-[#16161a] outline-none transition placeholder:text-[#a1a1aa] focus:border-[#16161a] focus:ring-2 focus:ring-[#16161a]/10 ${
            password ? "pr-11" : ""
          }`}
        />
        {password && (
          <button
            type="button"
            onClick={() => setShown((s) => !s)}
            aria-label={shown ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-[#6b6b75] hover:text-[#16161a]"
          >
            <EyeIcon off={shown} />
          </button>
        )}
      </div>
    </div>
  );
}

export function PrimaryButton({ children, loading, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return (
    <button
      {...props}
      disabled={loading || props.disabled}
      className="h-12 w-full rounded-full bg-[#16161a] text-[14px] font-semibold text-white transition hover:bg-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#16161a] disabled:opacity-60"
    >
      {loading ? "Please wait…" : children}
    </button>
  );
}

export function GoogleButton({ onClick, loading, label = "Continue with Google" }: { onClick: () => void; loading?: boolean; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="flex h-12 w-full items-center justify-center gap-3 rounded-full border border-[#e4e4e7] bg-white text-[14px] font-medium text-[#16161a] transition hover:bg-[#f7f7f8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#16161a] disabled:opacity-60"
    >
      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
        <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
        <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
        <path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 019.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 000 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z" />
        <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
      </svg>
      {label}
    </button>
  );
}

export function OrDivider() {
  return (
    <div className="flex items-center gap-3 py-1 text-[12px] text-[#8a8a93]">
      <span className="h-px flex-1 bg-[#ececef]" />
      or
      <span className="h-px flex-1 bg-[#ececef]" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Panneaux gauches                                                    */
/* ------------------------------------------------------------------ */

function FeatureCard({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="relative z-10 flex w-full max-w-[340px] items-center gap-3 rounded-2xl border border-black/5 bg-white px-4 py-3 shadow-[0_6px_20px_rgba(20,20,30,0.06)]">
      {icon}
      <div>
        <p className="text-[13px] font-semibold text-[#16161a]">{title}</p>
        <p className="text-[12px] text-[#6b6b75]">{text}</p>
      </div>
    </div>
  );
}

function SignUpVisual() {
  return (
    <div className="relative mt-8 flex flex-col gap-3">
      {/* blobs derrière les cartes */}
      <div className="absolute -top-2 left-[250px] h-24 w-24 rounded-full bg-[#e7e0fb]" />
      <div className="absolute top-[78px] left-[300px] h-24 w-24 rounded-full bg-[#fbd9dc]" />
      <div className="absolute top-[150px] left-[330px] h-24 w-24 rounded-full bg-[#c9f2e6]" />

      <FeatureCard
        icon={<Avatar size={40} bg="#f7d9a8" hair="#1d1718" skin="#e9b890" long />}
        title="AI conversations"
        text="Practice anytime"
      />
      <FeatureCard
        icon={
          <div className="flex -space-x-2">
            <Avatar size={32} bg="#f3d4b8" hair="#2b2220" skin="#e6b48f" />
            <Avatar size={32} bg="#cfe0f5" hair="#5a3b27" skin="#f1c9a5" />
          </div>
        }
        title="Real communities"
        text="Meet other learners"
      />
      <FeatureCard
        icon={
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#6d4ee3]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff" aria-hidden>
              <rect x="4" y="13" width="3.5" height="7" rx="1" />
              <rect x="10.2" y="9" width="3.5" height="11" rx="1" />
              <rect x="16.5" y="4" width="3.5" height="16" rx="1" />
            </svg>
          </span>
        }
        title="Track your progress"
        text="See real improvement"
      />
    </div>
  );
}

function Pill({ text, className }: { text: string; className: string }) {
  return (
    <div className={`absolute flex items-center gap-2 rounded-full border border-black/5 bg-white py-1.5 pl-1.5 pr-4 text-[12px] font-medium text-[#16161a] shadow-[0_6px_18px_rgba(20,20,30,0.07)] ${className}`}>
      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#d9f5e8] text-[#1f9d6b]">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <rect x="9" y="3" width="6" height="12" rx="3" />
          <path d="M5 11a7 7 0 0014 0M12 18v3" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
        </svg>
      </span>
      {text}
    </div>
  );
}

function SignInVisual() {
  return (
    <div className="relative mt-10 h-[300px] w-full max-w-[460px]">
      {/* lignes de connexion */}
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 460 300" fill="none" aria-hidden>
        <g stroke="#cfd4cf" strokeWidth="1" strokeDasharray="3 4">
          <path d="M70 70 C 110 120, 100 180, 80 240" />
          <path d="M190 55 C 200 120, 160 190, 130 245" />
          <path d="M230 120 C 240 180, 200 230, 175 250" />
          <path d="M120 245 L 80 255 M175 255 L 215 255" />
        </g>
      </svg>

      <Pill text="Speak confidently" className="left-0 top-0" />
      <Pill text="Learn from your mistakes" className="left-[120px] top-[78px]" />
      <Pill text="Join friendly communities" className="left-[74px] top-[158px]" />

      <div className="absolute left-0 top-[48px]">
        <Avatar size={44} bg="#cfe0f5" hair="#1d1718" skin="#e6b48f" />
      </div>
      <div className="absolute bottom-0 left-0 flex items-end gap-1.5">
        <Avatar size={34} bg="#f3d4b8" hair="#7a4a2a" skin="#f1c9a5" long />
        <Avatar size={34} bg="#cfe0f5" hair="#1d1718" skin="#e6b48f" />
        <Avatar size={44} bg="#f7d9a8" hair="#1d1718" skin="#d9a27c" long />
        <Avatar size={40} bg="#e3dcf7" hair="#2b2220" skin="#e9b890" />
        <Avatar size={34} bg="#d4efe3" hair="#1d1718" skin="#e6b48f" long />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shell                                                               */
/* ------------------------------------------------------------------ */

export function AuthShell({ mode, children }: { mode: "sign-in" | "sign-up"; children: ReactNode }) {
  const isSignUp = mode === "sign-up";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f1f1ef] p-3 sm:p-6">
      <div className="relative w-full max-w-[1180px] overflow-hidden rounded-[28px] border border-black/10 bg-[#fafaf8] shadow-[0_1px_0_rgba(255,255,255,0.8)_inset]">
        <div className="relative grid min-h-[680px] grid-cols-1 gap-10 px-6 py-8 sm:px-10 lg:grid-cols-2 lg:gap-6 lg:px-12 lg:py-10">
          {/* Colonne gauche */}
          <section className="flex flex-col">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand text-[18px] font-bold text-[#16161a]">T</span>
              <span className="text-[18px] font-semibold text-[#16161a]">Tkallem</span>
            </div>

            <div className="mt-12 lg:mt-16">
              <h1 className="max-w-[420px] text-[34px] font-semibold leading-[1.1] tracking-[-0.02em] text-[#16161a] sm:text-[40px]">
                {isSignUp ? "Get ready for your interview in English" : "Your English speaking coach"}
              </h1>
              <p className="mt-4 max-w-[400px] text-[15px] leading-relaxed text-[#6b6b75]">
                {isSignUp
                  ? "Free account: 60 answers to start, then 15 new answers every day. Your progress is saved."
                  : "Rehearse visa, Campus France and job interviews by voice, with every mistake explained in French."}
              </p>
            </div>

            <div className="hidden lg:block">{isSignUp ? <SignUpVisual /> : <SignInVisual />}</div>
          </section>

          {/* Colonne droite */}
          <section className="flex items-center justify-center lg:justify-end lg:pr-6">{children}</section>
        </div>
      </div>
    </main>
  );
}

export function AuthCard({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="relative z-10 w-full max-w-[460px] rounded-[20px] border border-black/5 bg-white px-6 py-8 shadow-[0_20px_60px_rgba(20,20,30,0.08)] sm:px-9 sm:py-9">
      <h2 className="text-[24px] font-semibold tracking-[-0.01em] text-[#16161a]">{title}</h2>
      <p className="mt-2 text-[14px] text-[#6b6b75]">{subtitle}</p>
      <div className="mt-7">{children}</div>
    </div>
  );
}

export function FormError({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg bg-[#fdecec] px-3 py-2 text-[13px] text-[#b42318]">
      {message}
    </p>
  );
}

export function clerkMessage(err: unknown): string {
  const e = err as { errors?: { longMessage?: string; message?: string }[] };
  return e?.errors?.[0]?.longMessage ?? e?.errors?.[0]?.message ?? "Something went wrong. Please try again.";
}