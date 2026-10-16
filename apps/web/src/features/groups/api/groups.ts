import { api } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type { GroupDetail, GroupDetailDto, GroupMessage, GroupMessageDto, GroupPreviewDto, GroupSummary, GroupSummaryDto, CheckedCorrection, LeaderboardEntry, LeaderboardEntryDto, ReportReason } from "../types/groups";

export const mapMessage = (m: GroupMessageDto): GroupMessage => ({ id: m.id, body: m.body, createdAt: m.created_at, author: { id: m.author.id, firstName: m.author.first_name }, authorLeft: m.author_left });
export const mapGroup = (g: GroupSummaryDto): GroupSummary => ({ id: g.id, name: g.name, level: g.level, memberCount: g.member_count, lastActivity: g.last_activity, theme: g.theme, language: { code: "en", name: "English" }, levelRange: g.level, description: "Practice with learners at your level.", tags: [g.theme.category], memberAvatars: [], isMember: false });
export const mapGroupDetail = (g: GroupDetailDto): GroupDetail => ({ id: g.id, name: g.name, level: g.level, memberCount: g.members.length, lastActivity: null, theme: g.theme, language: { code: "en", name: "English" }, levelRange: g.level, description: "Practice with learners at your level.", tags: [g.theme.category], memberAvatars: [], isMember: true, topics: [], moderators: [], members: g.members.map((m) => ({ id: m.id, firstName: m.first_name })) });
export const mapGroupPreview = (p: GroupPreviewDto) => ({ theme: p.theme, groups: p.groups.map(mapGroup) });

export const getGroupPreview = () => api.get<GroupPreviewDto>(endpoints.groups.preview).then(mapGroupPreview);
export const getMyGroup = () => api.get<GroupSummaryDto | null>(endpoints.groups.my).then((g) => g ? mapGroup(g) : null);
export const getGroups = (f: import("../types/groups").GroupFilters) =>
  api.get<GroupSummaryDto[]>(endpoints.groups.list, { query: { level: f.level } }).then((list) => list.map(mapGroup));
export const getSuggestedGroups = () => getGroups({});
export const getGroup = (id: number | string) => api.get<GroupDetailDto>(endpoints.groups.detail(id)).then(mapGroupDetail);
export const joinAGroup = (firstName?: string) => firstName ? api.patch(endpoints.me, { first_name: firstName }).then(() => api.post<GroupSummaryDto>(endpoints.groups.joinAny).then(mapGroup)) : api.post<GroupSummaryDto>(endpoints.groups.joinAny).then(mapGroup);
export const joinGroup = (id: number | string) => api.post<GroupSummaryDto>(endpoints.groups.join(id)).then(mapGroup);
export const leaveGroup = (id: number | string) => api.delete(endpoints.groups.leave(id));
export const checkDraft = (id: number, text: string) => api.post<CheckedCorrection[]>(endpoints.groups.check(id), { text });
export const getMessages = (id: number, q: { beforeId?: number; afterId?: number; limit?: number } = {}) => api.get<GroupMessageDto[]>(endpoints.groups.messages(id), { query: { before_id: q.beforeId, after_id: q.afterId, limit: q.limit ?? 50 } }).then((list) => list.map(mapMessage));
export const reportMessage = (id: number, messageId: number, reason: ReportReason) => api.post<{ hidden: boolean }>(endpoints.groups.report(id, messageId), { reason });
export const saveFirstName = (firstName: string) => api.patch<{ first_name: string; level: string; explain_lang: string }>(endpoints.me, { first_name: firstName }).then((u) => ({ ...u, firstName: u.first_name }));
export const sendMessage = (id: number, body: string) => api.post<GroupMessageDto>(endpoints.groups.messages(id), { body }).then(mapMessage);
export const getLeaderboard = (id: number) => api.get<LeaderboardEntryDto[]>(endpoints.groups.leaderboard(id)).then((list): LeaderboardEntry[] => list.map((e) => ({ rank: e.rank, member: { id: e.member.id, firstName: e.member.first_name }, weekSeconds: e.week_seconds, streakDays: e.streak_days, isMe: e.is_me })));
