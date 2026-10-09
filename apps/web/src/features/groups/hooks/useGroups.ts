"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as g from "../api/groups";
import type { GroupDetail, GroupFilters, GroupPost, GroupSummary } from "../types/groups";

export const useGroups = (f: GroupFilters) => useQuery({ queryKey: ["groups", f], queryFn: () => g.getGroups(f) });
export const useSuggestedGroups = () => useQuery({ queryKey: ["groups-suggested"], queryFn: g.getSuggestedGroups });
export const useUpcomingSessions = () => useQuery({ queryKey: ["group-sessions-upcoming"], queryFn: g.getUpcomingSessions });
export const useActiveTopics = () => useQuery({ queryKey: ["group-topics-active"], queryFn: g.getActiveTopics });
export const useGroup = (id: string) => useQuery({ queryKey: ["group", id], queryFn: () => g.getGroup(id) });
export const useGroupPosts = (id: string) => useQuery({ queryKey: ["group-posts", id], queryFn: () => g.getGroupPosts(id) });

/** Join/leave: real request, then patch every cached list + the detail view. */
export function useToggleMembership() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, join }: { id: string; join: boolean }) => (join ? g.joinGroup(id) : g.leaveGroup(id)),
    onSuccess: (_r, { id, join }) => {
      const delta = join ? 1 : -1;
      const patch = (x: GroupSummary) =>
        x.id === id ? { ...x, isMember: join, memberCount: Math.max(0, x.memberCount + delta) } : x;
      qc.setQueriesData<GroupSummary[]>({ queryKey: ["groups"] }, (old) => old?.map(patch));
      qc.setQueryData<GroupSummary[]>(["groups-suggested"], (old) => old?.map(patch));
      qc.setQueryData<GroupDetail>(["group", id], (old) => (old ? (patch(old) as GroupDetail) : old));
      qc.invalidateQueries({ queryKey: ["group-sessions-upcoming"] });
      qc.invalidateQueries({ queryKey: ["group-posts", id] });
    },
  });
}

export function useCreatePost(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => g.createPost(id, body),
    onSuccess: (post) => qc.setQueryData<GroupPost[]>(["group-posts", id], (old) => [post, ...(old ?? [])]),
  });
}

export function useLikePost(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (postId: string) => g.likePost(id, postId),
    onSuccess: (_r, postId) =>
      qc.setQueryData<GroupPost[]>(["group-posts", id], (old) =>
        old?.map((p) =>
          p.id === postId
            ? { ...p, likedByMe: !p.likedByMe, likeCount: p.likeCount + (p.likedByMe ? -1 : 1) }
            : p,
        ),
      ),
  });
}

export function useSetReminder(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => g.setSessionReminder(id, sessionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["group", id] });
      qc.invalidateQueries({ queryKey: ["group-sessions-upcoming"] });
    },
  });
}
