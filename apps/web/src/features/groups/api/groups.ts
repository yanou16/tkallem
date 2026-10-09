import { api } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type { ActiveTopic, GroupDetail, GroupFilters, GroupPost, GroupSession, GroupSummary } from "../types/groups";

export const getGroups = (f: GroupFilters) =>
  api.get<GroupSummary[]>(endpoints.groups.list, { query: { ...f } });
export const getSuggestedGroups = () => api.get<GroupSummary[]>(endpoints.groups.suggested);
export const getUpcomingSessions = () => api.get<GroupSession[]>(endpoints.groups.upcomingSessions);
export const getActiveTopics = () => api.get<ActiveTopic[]>(endpoints.groups.activeTopics);
export const getGroup = (id: string) => api.get<GroupDetail>(endpoints.groups.detail(id));
export const getGroupPosts = (id: string) => api.get<GroupPost[]>(endpoints.groups.posts(id));
export const getGroupSessions = (id: string) => api.get<GroupSession[]>(endpoints.groups.sessions(id));
export const joinGroup = (id: string) => api.post(endpoints.groups.join(id));
export const leaveGroup = (id: string) => api.post(endpoints.groups.leave(id));
export const createPost = (id: string, body: string) => api.post<GroupPost>(endpoints.groups.posts(id), { body });
export const likePost = (id: string, postId: string) => api.post(endpoints.groups.likePost(id, postId));
export const setSessionReminder = (id: string, sessionId: string) =>
  api.post(endpoints.groups.sessionReminder(id, sessionId));
