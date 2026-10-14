/**
 * Every backend path in the app. If the backend differs, change it HERE only.
 */
export const endpoints = {
  me: "/me",
  mySessions: "/me/sessions",
  myAchievements: "/me/achievements",
  scenarios: "/scenarios",
  ai: {
    sessions: "/sessions",
    session: (id: string) => `/sessions/${id}`,
    turn: (id: string) => `/sessions/${id}/turn`,
    end: (id: string) => `/sessions/${id}/end`,
    speak: (id: string) => `/sessions/${id}/speak`,
    hint: (id: string) => `/sessions/${id}/hint`,
    repeat: (id: string) => `/sessions/${id}/repeat`,
    confidence: (id: string) => `/sessions/${id}/confidence`,
  },
  groups: {
    mine: "/me/group",
    /** The only group route a guest may call: theme, question of the day, a few groups (no names, no messages). */
    preview: "/groups/preview",
    join: "/groups/join",
    detail: (id: number) => `/groups/${id}`,
    messages: (id: number) => `/groups/${id}/messages`,
    report: (id: number, messageId: number) => `/groups/${id}/messages/${messageId}/report`,
    leave: (id: number) => `/groups/${id}/members/me`,
    check: (id: number) => `/groups/${id}/check`,
    leaderboard: (id: number) => `/groups/${id}/leaderboard`,
    /** WebSocket, on WS_URL: receives only, sending goes through `messages`. */
    socket: (id: number) => `/ws/groups/${id}`,
  },
  progress: "/me/progress",
} as const;
