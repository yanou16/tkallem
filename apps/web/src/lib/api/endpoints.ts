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
    confidence: (id: string) => `/sessions/${id}/confidence`,
    hint: (id: string) => `/sessions/${id}/hint`,
    repeat: (id: string) => `/sessions/${id}/repeat`,
  },
  groups: {
    preview: "/groups/preview",
    list: "/groups/recommended",
    suggested: "/groups/recommended",
    my: "/me/group",
    joinAny: "/groups/join",
    detail: (id: number | string) => `/groups/${id}`,
    join: (id: number | string) => `/groups/${id}/join`,
    leave: (id: number | string) => `/groups/${id}/members/me`,
    messages: (id: number | string) => `/groups/${id}/messages`,
    check: (id: number | string) => `/groups/${id}/check`,
    leaderboard: (id: number | string) => `/groups/${id}/leaderboard`,
    report: (id: number | string, messageId: number) => `/groups/${id}/messages/${messageId}/report`,
  },
  progress: "/me/progress",
} as const;
