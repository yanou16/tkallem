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
    scenarios: "/scenarios",
    recent: "/me/sessions", // recommended and focus are computed in features/practice/api from /me/sessions and /me/progress
  },
  ai: {
    sessions: "/sessions",
    session: (id: string) => `/sessions/${id}`,
    turn: (id: string) => `/sessions/${id}/turn`,
    end: (id: string) => `/sessions/${id}/end`,
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
