/**
 * Every backend path in the app. If the backend differs, change it HERE only.
 */
export const endpoints = {
  auth: {
    login: "/api/auth/login",
    register: "/api/auth/register",
    logout: "/api/auth/logout",
    me: "/me",
  },
  user: {
    me: "/me",
    languages: "/api/users/me/languages",
    avatar: "/api/users/me/avatar",
    achievements: "/api/users/me/achievements",
    activity: "/api/users/me/activity",
    preferences: "/api/users/me/preferences",
    notificationsUnread: "/api/notifications/unread-count",
  },
  dashboard: "/api/dashboard",
  mistakes: { top: "/api/mistakes/top" },
  practice: {
    scenarios: "/api/practice/scenarios",
    recent: "/api/practice/sessions/recent",
    recommended: "/api/practice/recommended",
    focus: "/api/practice/focus",
  },
  ai: {
    sessions: "/api/ai/sessions",
    session: (id: string) => `/api/ai/sessions/${id}`,
    messages: (id: string) => `/api/ai/sessions/${id}/messages`,
    voice: (id: string) => `/api/ai/sessions/${id}/voice`,
    saveCorrection: (sid: string, cid: string) => `/api/ai/sessions/${sid}/corrections/${cid}/save`,
    assist: "/api/ai/assist",
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
  progress: "/api/progress",
} as const;
