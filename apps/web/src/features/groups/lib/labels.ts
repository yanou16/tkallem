/** What the groups screen writes, kept pure so it is tested in labels.test.ts. */
import { ApiError } from "@/lib/api/client";
import { mistakeLabel } from "@/features/progress/types/progress";
import type { CheckedCorrection, Member, ReportReason } from "../types/groups";

/** The fine-grained rule (verb_tense, preposition…), else the correction type (grammar, vocabulary…). */
export const correctionLabel = (c: Pick<CheckedCorrection, "rule" | "type">) => mistakeLabel(c.rule ?? c.type);

export const memberName = (m: Member, isMe = false) => (isMe ? "You" : m.firstName?.trim() || "Member");

export const REASON_LABELS: Record<ReportReason, string> = {
  insult: "Insult",
  harassment: "Harassment",
  spam: "Spam",
  other: "Something else",
};

const status = (e: unknown) => (e instanceof ApiError ? e.status : undefined);
const fallback = (e: unknown) => (e instanceof ApiError ? e.message : "Something went wrong. Try again.");

export function sendError(e: unknown): string {
  if (status(e) === 429) return "You sent 20 messages in the last minute. Wait a moment, then send again.";
  if (status(e) === 403) return "You are no longer a member of this group.";
  if (status(e) === 422) return "A message has 1 to 500 characters.";
  return fallback(e);
}

export function checkError(e: unknown): string {
  if (status(e) === 429) return "You used your 30 checks of the last 24 hours. You can check again later.";
  if (status(e) === 502) return "The check is not available right now. Try again in a moment.";
  if (status(e) === 422) return "A text to check has 1 to 500 characters.";
  return fallback(e);
}

export function reportError(e: unknown): string {
  if (status(e) === 409) return "You already reported this message.";
  if (status(e) === 403) return "You can only report other members' messages.";
  if (status(e) === 404) return "This message is no longer in the group.";
  return fallback(e);
}

export function joinError(e: unknown): string {
  if (status(e) === 403) return "Groups are for students with an account: sign up to join one.";
  if (status(e) === 409) return "You are already in a group, or your level is not chosen yet.";
  return fallback(e);
}

/** Why live updates stopped, for a final close code (the others reconnect). */
export function closedReason(code: number): string {
  if (code === 4403) return "You are no longer a member of this group.";
  if (code === 4404) return "This group no longer exists.";
  if (code === 4401) return "Your session expired. Reload the page to see new messages.";
  return "Live updates are off. Reload the page to see new messages.";
}
