export type Level = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
export type Theme = { id: string; title: string; category: "travel" | "work" | "study" | "exams" | "daily_life"; question?: string };
export type ThemeOfTheDay = Theme & { question: string };
export type Member = { id: number; firstName: string | null };
export type Person = { id: string; name: string; avatarUrl?: string; online?: boolean; role?: string };

export type GroupSummaryDto = { id: number; name: string; level: Level; member_count: number; last_activity: string | null; theme: Theme };
export type GroupMessageDto = { id: number; body: string; created_at: string; author: { id: number; first_name: string | null }; author_left: boolean };
export type GroupPreviewDto = { theme: ThemeOfTheDay; groups: GroupSummaryDto[] };
export type GroupDetailDto = { id: number; name: string; level: Level; members: { id: number; first_name: string | null }[]; theme: ThemeOfTheDay };
export type CheckedCorrection = { original: string; correction: string; explanation: string; type: "grammar" | "vocabulary" | "word_choice" | "other"; rule: string | null };
export type LeaderboardEntryDto = { rank: number; member: { id: number; first_name: string | null }; week_seconds: number; streak_days: number; is_me: boolean };
export type LeaderboardEntry = { rank: number; member: Member; weekSeconds: number; streakDays: number; isMe: boolean };
export type ReportReason = "insult" | "harassment" | "spam" | "other";
export const REPORT_REASONS: readonly ReportReason[] = ["insult", "harassment", "spam", "other"];
export type GroupMessage = { id: number; body: string; createdAt: string; author: Member; authorLeft: boolean };
export type MessageLog = { messages: GroupMessage[]; hasOlder: boolean };

export type GroupSummary = {
  id: number; name: string; level: Level; memberCount: number; lastActivity: string | null; theme: Theme;
  language: { code: string; name: string; flagUrl?: string }; levelRange: string; description: string; tags: string[]; memberAvatars: Person[];
  isMember: boolean; hasVoiceRoom?: boolean; isExamPrep?: boolean;
};
export type GroupSession = { id: string; groupId: string; groupName?: string; title: string; startsAt: string; startsAtLabel?: string; durationMinutes: number; icon?: string; hasReminder?: boolean; isMember?: boolean };
export type ActiveTopic = { id: string; name: string; conversationCount: string; trend: string };
export type GroupDetail = { id: number; name: string; level: Level; members?: Member[]; theme: ThemeOfTheDay; memberCount?: number; lastActivity?: string | null; language?: { code: string; name: string; flagUrl?: string }; levelRange?: string; description?: string; tags?: string[]; memberAvatars?: Person[]; isMember?: boolean; imageUrl?: string; createdAt?: string; topics?: string[]; levelLabel?: string; todayTopic?: { title: string; description?: string } | null; liveVoiceRoom?: { id: string; title: string; participantCount: number; isOpen: boolean; participants: Person[] } | null; nextSession?: GroupSession | null; moderators?: Person[] };
export type GroupPost = { id: string; author: Person; createdAt: string; body: string; likeCount: number; commentCount: number; likedByMe: boolean };
export type GroupFilters = { search?: string; language?: string; level?: string; topic?: string; voiceRooms?: boolean; examPrep?: boolean };

export type GroupEventDto = { type: string; [key: string]: unknown };
