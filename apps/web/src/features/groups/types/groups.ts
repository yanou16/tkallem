import type { Level } from "@/features/auth/types/user";

/* ---------- as sent by the API (snake_case) ---------- */
export type ThemeCategory = "travel" | "work" | "study" | "exams" | "daily_life";
export type ThemeDto = { id: string; title: string; category: ThemeCategory };

/** POST /groups/join and GET /me/group (null when the student is in no group). */
export type GroupSummaryDto = {
  id: number;
  name: string;
  level: Level;
  member_count: number;
  last_activity: string | null;
  theme: ThemeDto;
};

export type GroupMemberDto = { id: number; first_name: string | null };

/** GET /groups/{id}, members only. */
export type GroupDetailDto = {
  id: number;
  name: string;
  level: Level;
  members: GroupMemberDto[];
  theme: ThemeDto & { question: string }; // the theme of the week and the question of the day
};

/** GET /groups/{id}/messages (oldest first), POST /groups/{id}/messages and the message.created event. */
export type GroupMessageDto = {
  id: number;
  body: string;
  created_at: string;
  author: GroupMemberDto;
  author_left: boolean; // a former member
};

export type CorrectionType = "grammar" | "vocabulary" | "word_choice" | "other";

/** POST /groups/{id}/check: private, nothing is posted. */
export type CheckedCorrectionDto = {
  original: string;
  correction: string;
  explanation: string; // in the student's explanation language
  type: CorrectionType;
  rule: string | null;
};

/** GET /groups/{id}/leaderboard: practice over the last 7 days. */
export type LeaderboardEntryDto = {
  rank: number;
  member: GroupMemberDto;
  week_seconds: number;
  streak_days: number;
  is_me: boolean;
};

export type ReportReason = "insult" | "harassment" | "spam" | "other";
export const REPORT_REASONS: ReportReason[] = ["insult", "harassment", "spam", "other"];

/** What WS /ws/groups/{id} sends after {"type": "auth"}. */
export type GroupEventDto =
  | { type: "auth.ok" }
  | { type: "ping" }
  | { type: "pong" }
  | { type: "message.created"; message: GroupMessageDto }
  | { type: "message.hidden"; message_id: number }
  | { type: "member.joined"; member: GroupMemberDto }
  | { type: "member.left"; member: GroupMemberDto };

/* ---------- what the screen uses ---------- */
export type Theme = { id: string; title: string; category: ThemeCategory };

export type GroupSummary = {
  id: number;
  name: string;
  level: Level;
  memberCount: number;
  lastActivity: string | null;
  theme: Theme;
};

/** firstName is null when the member never gave one. */
export type Member = { id: number; firstName: string | null };

export type GroupDetail = {
  id: number;
  name: string;
  level: Level;
  members: Member[];
  theme: Theme & { question: string };
};

export type GroupMessage = {
  id: number;
  body: string;
  createdAt: string;
  author: Member;
  authorLeft: boolean;
};

/** The messages loaded so far, oldest first, and whether older ones can still be loaded (scrolling up). */
export type MessageLog = { messages: GroupMessage[]; hasOlder: boolean };

export type CheckedCorrection = {
  original: string;
  correction: string;
  explanation: string;
  type: CorrectionType;
  rule: string | null;
};

export type LeaderboardEntry = {
  rank: number;
  member: Member;
  weekSeconds: number;
  streakDays: number;
  isMe: boolean;
};
