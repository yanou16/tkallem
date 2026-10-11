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
  },
  groups: {
    list: "/api/groups",
    suggested: "/api/groups/suggested",
    upcomingSessions: "/api/groups/sessions/upcoming",
    activeTopics: "/api/groups/topics/active",
    detail: (id: string) => `/api/groups/${id}`,
    join: (id: string) => `/api/groups/${id}/join`,
    leave: (id: string) => `/api/groups/${id}/leave`,
    posts: (id: string) => `/api/groups/${id}/posts`,
    likePost: (id: string, postId: string) => `/api/groups/${id}/posts/${postId}/like`,
    sessions: (id: string) => `/api/groups/${id}/sessions`,
    sessionReminder: (id: string, sessionId: string) => `/api/groups/${id}/sessions/${sessionId}/reminder`,
  },
  progress: "/me/progress",
} as const;
