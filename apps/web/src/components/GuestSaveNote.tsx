import Link from "next/link";
import { ROUTES } from "@/lib/config";

export const GUEST_SAVE_TEXT = "Saved on this device. Create an account to keep it on any device.";

/** For a guest only: what they did is kept on this device (the guest token lives in the browser), and an account keeps it
 *  everywhere. Shown on the report and on the Progress page. */
export default function GuestSaveNote({ className }: { className?: string }) {
  return (
    <div className={`rounded-card border border-hairline p-4 ${className ?? ""}`}>
      <p className="text-slate">{GUEST_SAVE_TEXT}</p>
      <Link href={ROUTES.signUp} className="mt-3 inline-flex min-h-11 items-center rounded-full border border-hairline-strong px-5 text-sm font-semibold hover:bg-surface">
        Create an account
      </Link>
    </div>
  );
}
