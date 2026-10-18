import { api } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import { mapMe } from "@/features/auth/api/getCurrentUser";
import type { MeDto } from "@/features/auth/types/user";
import type {
  CheckedCorrection,
  CheckedCorrectionDto,
  GroupDetail,
  GroupDetailDto,
  GroupMemberDto,
  GroupMessage,
  GroupMessageDto,
  GroupPreview,
  GroupPreviewDto,
  GroupSummary,
  GroupSummaryDto,
  LeaderboardEntry,
  LeaderboardEntryDto,
  Member,
  ReportReason,
} from "../types/groups";

/** Messages per page: scrolling up loads this many older ones. The API accepts up to 100. */
export const PAGE_SIZE = 50;

export const mapMember = (m: GroupMemberDto): Member => ({ id: m.id, firstName: m.first_name });

export const mapGroupSummary = (g: GroupSummaryDto): GroupSummary => ({
  id: g.id,
  name: g.name,
  level: g.level,
  memberCount: g.member_count,
  lastActivity: g.last_activity,
  theme: g.theme,
});

export const mapGroupDetail = (g: GroupDetailDto): GroupDetail => ({
  id: g.id,
  name: g.name,
  level: g.level,
  members: g.members.map(mapMember),
  theme: g.theme,
});

export const mapMessage = (m: GroupMessageDto): GroupMessage => ({
  id: m.id,
  body: m.body,
  createdAt: m.created_at,
  author: mapMember(m.author),
  authorLeft: m.author_left,
});

export const mapCorrection = (c: CheckedCorrectionDto): CheckedCorrection => ({
  original: c.original,
  correction: c.correction,
  explanation: c.explanation,
  type: c.type,
  rule: c.rule,
});

export const mapLeaderboardEntry = (e: LeaderboardEntryDto): LeaderboardEntry => ({
  rank: e.rank,
  member: mapMember(e.member),
  weekSeconds: e.week_seconds,
  streakDays: e.streak_days,
  isMe: e.is_me,
});

/** The student's group, or null. */
export const getMyGroup = () =>
  api.get<GroupSummaryDto | null>(endpoints.groups.mine).then((g) => (g ? mapGroupSummary(g) : null));

/** The most active group of the student's level with room left, or a new one created by the API. */
export const joinAGroup = () => api.post<GroupSummaryDto>(endpoints.groups.join).then(mapGroupSummary);

export const getGroup = (id: number) => api.get<GroupDetailDto>(endpoints.groups.detail(id)).then(mapGroupDetail);

/** Oldest first. beforeId: the page before (scrolling up); afterId: what came after (catching up); neither: the latest. */
export const getMessages = (id: number, page: { beforeId?: number; afterId?: number; limit?: number } = {}) =>
  api
    .get<GroupMessageDto[]>(endpoints.groups.messages(id), {
      query: { before_id: page.beforeId, after_id: page.afterId, limit: page.limit ?? PAGE_SIZE },
    })
    .then((list) => list.map(mapMessage));

export const sendMessage = (id: number, body: string) =>
  api.post<GroupMessageDto>(endpoints.groups.messages(id), { body }).then(mapMessage);

export const leaveGroup = (id: number) => api.delete<void>(endpoints.groups.leave(id));

/** hidden: this report was the one that hid the message for the whole group. */
export const reportMessage = (id: number, messageId: number, reason: ReportReason) =>
  api.post<{ hidden: boolean }>(endpoints.groups.report(id, messageId), { reason });

export const checkDraft = (id: number, text: string) =>
  api.post<CheckedCorrectionDto[]>(endpoints.groups.check(id), { text }).then((list) => list.map(mapCorrection));

export const getLeaderboard = (id: number) =>
  api.get<LeaderboardEntryDto[]>(endpoints.groups.leaderboard(id)).then((list) => list.map(mapLeaderboardEntry));

/** The first name the other members see (PATCH /me first_name). */
export const saveFirstName = (firstName: string) =>
  api.patch<MeDto>(endpoints.me, { first_name: firstName }).then(mapMe);

export const mapGroupPreview = (p: GroupPreviewDto): GroupPreview => ({ theme: p.theme, groups: p.groups.map(mapGroupSummary) });
export const getGroupPreview = () => api.get<GroupPreviewDto>(endpoints.groups.preview).then(mapGroupPreview);
