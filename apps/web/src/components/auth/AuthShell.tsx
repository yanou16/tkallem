"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { useState, type InputHTMLAttributes, type ReactNode } from "react";

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
      <label htmlFor={fieldId} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
        {hint && <span className="ml-1 text-sm font-normal text-slate">({hint})</span>}
      </label>
      <div className="relative">
        <input
          id={fieldId}
          {...props}
          type={password ? (shown ? "text" : "password") : props.type}
          className={`h-11 w-full rounded-lg border border-hairline-strong bg-white px-3.5 text-base text-ink sm:text-sm outline-none transition placeholder:text-steel focus:border-ink focus:ring-2 focus:ring-ink/10 ${
            password ? "pr-11" : ""
          }`}
        />
        {password && (
          <button
            type="button"
            onClick={() => setShown((s) => !s)}
            aria-label={shown ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate hover:text-ink"
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
      className="h-12 w-full rounded-full bg-ink text-sm font-semibold text-white transition active:scale-[0.98] hover:bg-black/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-60"
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
      className="flex h-12 w-full items-center justify-center gap-3 rounded-full border border-hairline-strong bg-white text-sm font-medium text-ink transition hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-60"
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
    <div className="flex items-center gap-3 py-1 text-sm text-slate">
      <span className="h-px flex-1 bg-hairline" />
      or
      <span className="h-px flex-1 bg-hairline" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Panneaux gauches                                                    */
/* ------------------------------------------------------------------ */

/** What the account is for, in three plain facts (no invented users, no decoration). */
function AuthFacts({ isSignUp }: { isSignUp: boolean }) {
  const facts = isSignUp
    ? ["60 answers to start, then 15 more every day", "Every mistake explained in French", "Your progress and your answers are saved"]
    : ["The real questions of visa, Campus France, job and IELTS interviews", "Every mistake explained in French", "40 free answers without an account"];
  return (
    <ul className="mt-10 space-y-3">
      {facts.map((t) => (
        <li key={t} className="flex max-w-[400px] items-start gap-3 text-base text-charcoal">
          <Check size={18} className="mt-1 shrink-0 text-good" aria-hidden /> {t}
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Shell                                                               */
/* ------------------------------------------------------------------ */

export function AuthShell({ mode, children }: { mode: "sign-in" | "sign-up"; children: ReactNode }) {
  const isSignUp = mode === "sign-up";

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-4 sm:p-6">
      <div className="relative w-full max-w-[1180px]">
        <div className="relative grid grid-cols-1 gap-6 py-2 sm:px-6 lg:min-h-[680px] lg:grid-cols-2 lg:gap-6 lg:px-12 lg:py-10">
          {/* Colonne gauche */}
          <section className="flex flex-col">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand text-[18px] font-semibold text-ink">T</span>
              <Link href="/welcome" className="inline-flex min-h-11 items-center text-[18px] font-semibold text-ink">Tkallem</Link>
            </div>

            <div className="mt-6 lg:mt-16">
              <h1 className="max-w-[420px] text-[28px] font-medium leading-[1.15] tracking-tight text-ink sm:text-[40px]">
                {isSignUp ? "Get ready for your interview in English" : "Your English speaking coach"}
              </h1>
              <p className="mt-3 max-w-[400px] text-base leading-relaxed text-slate">
                {isSignUp
                  ? "Free account: 60 answers to start, then 15 new answers every day. Your progress is saved."
                  : "Rehearse visa, Campus France and job interviews by voice, with every mistake explained in French."}
              </p>
            </div>

            <div className="hidden lg:block"><AuthFacts isSignUp={isSignUp} /></div>
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
    <div className="relative z-10 w-full max-w-[460px] rounded-[20px] border border-line bg-white px-5 py-6 sm:px-9 sm:py-9">
      <h2 className="text-2xl font-medium tracking-tight text-ink">{title}</h2>
      <p className="mt-2 text-sm text-slate">{subtitle}</p>
      <div className="mt-5 sm:mt-7">{children}</div>
    </div>
  );
}

export function FormError({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg bg-bad-bg px-3 py-2 text-sm text-bad">
      {message}
    </p>
  );
}

export function clerkMessage(err: unknown): string {
  const e = err as { errors?: { longMessage?: string; message?: string }[] };
  return e?.errors?.[0]?.longMessage ?? e?.errors?.[0]?.message ?? "Something went wrong. Please try again.";
}