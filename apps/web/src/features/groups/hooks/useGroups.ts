"use client";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as g from "../api/groups";
import { CURRENT_USER_KEY } from "@/features/auth/hooks/useCurrentUser";
import type { Me } from "@/features/auth/types/user";
import { endpoints } from "@/lib/api/endpoints";
import { WS_URL } from "@/lib/config";
import { addNewer, addOlder, applyMemberEvent, catchUp, firstPage, hideMessage, lastId, markAuthor } from "../lib/messages";
import { connectGroupSocket, type SocketStatus } from "../lib/socket";
import type { GroupDetail, MessageLog, ReportReason } from "../types/groups";

export const MY_GROUP_KEY = ["my-group"] as const;
const groupKey = (id: number) => ["group", id] as const;
const messagesKey = (id: number) => ["group-messages", id] as const;
const leaderboardKey = (id: number) => ["group-leaderboard", id] as const;

/** Catching up after a reconnection asks for the largest page the API gives. */
const CATCH_UP_PAGE = 100;

export const useGroupPreview = () => useQuery({ queryKey: ["group-preview"], queryFn: g.getGroupPreview });
export const useMyGroup = () => useQuery({ queryKey: MY_GROUP_KEY, queryFn: g.getMyGroup });
export const useGroup = (id: number) => useQuery({ queryKey: groupKey(id), queryFn: () => g.getGroup(id) });
export const useLeaderboard = (id: number) => useQuery({ queryKey: leaderboardKey(id), queryFn: () => g.getLeaderboard(id) });

/** The latest page when the group opens; then useGroupSocket merges the live messages and useLoadOlder the older pages. */
export const useMessages = (id: number) =>
  useQuery({
    queryKey: messagesKey(id),
    queryFn: async () => firstPage(await g.getMessages(id), g.PAGE_SIZE),
    staleTime: Infinity, // kept fresh by the WebSocket
    refetchOnMount: "always", // nothing was received while the group was closed
  });

/** Scrolling up: the page before the oldest message shown. */
export function useLoadOlder(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const oldest = qc.getQueryData<MessageLog>(messagesKey(id))?.messages[0];
      return oldest ? g.getMessages(id, { beforeId: oldest.id }) : [];
    },
    onSuccess: (page) => qc.setQueryData<MessageLog>(messagesKey(id), (log) => log && addOlder(log, page, g.PAGE_SIZE)),
  });
}

/** The first name saved in our API (what the other members see), not Clerk's. Read when the student clicks Join. */
export function useSavedFirstName() {
  const qc = useQueryClient();
  return () => qc.getQueryData<Me>(CURRENT_USER_KEY)?.firstName?.trim() || null;
}

/** Joins the best group of the student's level (the API creates one when all are full), saving the first name first if given. */
export function useJoinGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (firstName?: string) => {
      if (firstName !== undefined) qc.setQueryData(CURRENT_USER_KEY, await g.saveFirstName(firstName));
      return g.joinAGroup();
    },
    onSuccess: (group) => qc.setQueryData(MY_GROUP_KEY, group),
    onError: () => qc.invalidateQueries({ queryKey: MY_GROUP_KEY }), // already in a group (another tab)
  });
}

export function useSendMessage(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => g.sendMessage(id, body),
    // Shown at once; its own message.created event arrives too and is merged by id.
    onSuccess: (message) => qc.setQueryData<MessageLog>(messagesKey(id), (log) => log && addNewer(log, [message])),
  });
}

export function useLeaveGroup(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => g.leaveGroup(id),
    onSuccess: () => qc.setQueryData(MY_GROUP_KEY, null),
  });
}

export function useReportMessage(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ messageId, reason }: { messageId: number; reason: ReportReason }) => g.reportMessage(id, messageId, reason),
    onSuccess: (result, { messageId }) => {
      if (result.hidden) qc.setQueryData<MessageLog>(messagesKey(id), (log) => log && hideMessage(log, messageId));
    },
  });
}

/** Private check of a draft: nothing is posted or stored. */
export const useCheckDraft = (id: number) => useMutation({ mutationFn: (text: string) => g.checkDraft(id, text) });

/** Live events of the group, merged into the cached messages, members and leaderboard. Returns the connection state. */
export function useGroupSocket(id: number) {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  const [status, setStatus] = useState<SocketStatus>({ state: "connecting" });
  const token = useRef(getToken);
  token.current = getToken;

  useEffect(() => {
    const setLog = (update: (log: MessageLog) => MessageLog) =>
      qc.setQueryData<MessageLog>(messagesKey(id), (log) => log && update(log));
    const reloadMessages = () => qc.invalidateQueries({ queryKey: messagesKey(id) });

    const connection = connectGroupSocket({
      url: `${WS_URL}${endpoints.groups.socket(id)}`,
      getToken: () => token.current(),
      onStatus: (s) => {
        setStatus(s);
        // Left in another tab, or the group is gone: the page goes back to "Join a group".
        if (s.state === "closed" && (s.code === 4403 || s.code === 4404)) qc.invalidateQueries({ queryKey: MY_GROUP_KEY });
      },
      onEvent: (e) => {
        if (e.type === "message.created") setLog((log) => addNewer(log, [g.mapMessage(e.message)]));
        else if (e.type === "message.hidden") setLog((log) => hideMessage(log, e.message_id));
        else if (e.type === "member.joined" || e.type === "member.left") {
          const member = g.mapMember(e.member);
          qc.setQueryData<GroupDetail>(groupKey(id), (d) => d && applyMemberEvent(d, e.type, member));
          setLog((log) => markAuthor(log, member.id, e.type === "member.left"));
          qc.invalidateQueries({ queryKey: leaderboardKey(id) });
        }
      },
      onReconnected: () => {
        // While the connection was lost: the messages after the last one shown, and who joined or left.
        qc.invalidateQueries({ queryKey: groupKey(id) });
        const after = lastId(qc.getQueryData<MessageLog>(messagesKey(id)));
        if (after === undefined) return void reloadMessages();
        catchUp((afterId) => g.getMessages(id, { afterId, limit: CATCH_UP_PAGE }), after, CATCH_UP_PAGE)
          .then(({ messages, complete }) => {
            if (complete) setLog((log) => addNewer(log, messages));
            else void reloadMessages();
          })
          .catch(() => reloadMessages());
      },
    });
    return () => connection.close();
  }, [id, qc]);

  return status;
}
