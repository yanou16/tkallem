"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as g from "../api/groups";
import { useAuth } from "@clerk/nextjs";
import { useEffect, useRef, useState } from "react";
import { connectGroupSocket } from "../lib/socket";
import { addNewer, addOlder, firstPage, markAuthor, hideMessage, lastId } from "../lib/messages";
import type { MessageLog, ReportReason } from "../types/groups";
import type { GroupDetail, GroupFilters, GroupSummary } from "../types/groups";

export const useGroups = (f: GroupFilters) => useQuery({ queryKey: ["groups", f], queryFn: () => g.getGroups(f) });
export const useSuggestedGroups = () => useQuery({ queryKey: ["groups-suggested"], queryFn: g.getSuggestedGroups });
export const useGroup = (id: number | string) => useQuery({ queryKey: ["group", id], queryFn: () => g.getGroup(id) });

/** Join/leave: real request, then patch every cached list + the detail view. */
export function useToggleMembership() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, join }: { id: number | string; join: boolean }) => (join ? g.joinGroup(id) : g.leaveGroup(id)),
    onSuccess: (_r, { id, join }) => {
      const delta = join ? 1 : -1;
      const patch = (x: GroupSummary) =>
        String(x.id) === String(id) ? { ...x, isMember: join, memberCount: Math.max(0, x.memberCount + delta) } : x;
      qc.setQueriesData<GroupSummary[]>({ queryKey: ["groups"] }, (old) => old?.map(patch));
      qc.setQueryData<GroupSummary[]>(["groups-suggested"], (old) => old?.map(patch));
      qc.setQueryData<GroupDetail>(["group", id], (old) => old ? { ...old, isMember: join, memberCount: Math.max(0, (old.memberCount ?? 0) + delta) } : old);
    },
  });
}

export const useGroupPreview = () => useQuery({ queryKey: ["group-preview"], queryFn: g.getGroupPreview });
export const useMyGroup = () => useQuery({ queryKey: ["my-group"], queryFn: g.getMyGroup });
export const useJoinGroup = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (firstName?: string) => g.joinAGroup(firstName),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["my-group"] }); },
  });
};
export const useCheckDraft = (id: number) => useMutation({ mutationFn: (text: string) => g.checkDraft(id, text) });
export const useLeaderboard = (id: number) => useQuery({ queryKey: ["leaderboard", id], queryFn: () => g.getLeaderboard(id) });
export const useLeaveGroup = (id: number) => { const qc = useQueryClient(); return useMutation({ mutationFn: () => g.leaveGroup(id), onSuccess: () => { void qc.invalidateQueries({ queryKey: ["group", id] }); } }); };
export const useMessages = (id: number) => useQuery<MessageLog>({ queryKey: ["messages", id], queryFn: async () => firstPage(await g.getMessages(id), 50) });
export const useLoadOlder = (id: number) => { const qc = useQueryClient(); return useMutation({ mutationFn: async () => { const old = qc.getQueryData<MessageLog>(["messages", id]); const first = old?.messages[0]?.id; return first === undefined ? null : g.getMessages(id, { beforeId: first }); }, onSuccess: (page) => { if (!page) return; qc.setQueryData<MessageLog>(["messages", id], (old) => old ? addOlder(old, page, 50) : firstPage(page, 50)); } }); };
export const useSendMessage = (id: number) => { const qc = useQueryClient(); return useMutation({ mutationFn: (body: string) => g.sendMessage(id, body), onSuccess: (message) => {
      qc.setQueryData<MessageLog>(["messages", id], (old) => old ? addNewer(old, [message]) : old);
    } }); };
export const useReportMessage = (id: number) => { const qc = useQueryClient(); return useMutation({ mutationFn: ({ messageId, reason }: { messageId: number; reason: ReportReason }) => g.reportMessage(id, messageId, reason), onSuccess: (_r, v) => qc.setQueryData<MessageLog>(["messages", id], (old) => old ? hideMessage(old, v.messageId) : old) }); };
export const useGroupSocket = (id: number) => {
  const qc = useQueryClient(); const { getToken } = useAuth(); const qcRef = useRef(qc); qcRef.current = qc;
  const [status, setStatus] = useState<import("../lib/socket").SocketStatus>({ state: "connecting" });
  useEffect(() => {
    const url = `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws/groups/${id}`;
    const connection = connectGroupSocket({ url, getToken, onStatus: setStatus, onEvent: (event) => {
      if (event.type === "message.created") { const message = (event as unknown as { message: import("../types/groups").GroupMessageDto }).message; qcRef.current.setQueryData<MessageLog>(["messages", id], (old) => old ? addNewer(old, [g.mapMessage(message)]) : old); }
      else if (event.type === "message.hidden") { const messageId = (event as unknown as { message_id: number }).message_id; qcRef.current.setQueryData<MessageLog>(["messages", id], (old) => old ? hideMessage(old, messageId) : old); }
      else if (event.type === "member.joined" || event.type === "member.left") {
        void qcRef.current.invalidateQueries({ queryKey: ["group", id] });
      }
    }, onReconnected: () => { const old = qcRef.current.getQueryData<MessageLog>(["messages", id]); const cursor = lastId(old); if (cursor !== undefined) void g.getMessages(id, { afterId: cursor }).then((page) => qcRef.current.setQueryData<MessageLog>(["messages", id], (current) => current ? addNewer(current, page) : current)); } });
    return () => connection.close();
  }, [id, getToken]);
  return status;
};
