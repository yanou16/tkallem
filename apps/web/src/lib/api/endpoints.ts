/**
 * Every backend path in the app. If the backend differs, change it HERE only.
 */
export const endpoints = {
  me: "/me",
  mySessions: "/me/sessions",
  myCorrections: "/me/corrections",
  phraseOfDay: "/phrase-of-the-day",
  phraseOfDayCheck: "/phrase-of-the-day/check",
  myAchievements: "/me/achievements",
  scenarios: "/scenarios",
  ai: {
    sessions: "/sessions",
    session: (id: string) => `/sessions/${id}`,
    turn: (id: string) => `/sessions/${id}/turn`,
    end: (id: string) => `/sessions/${id}/end`,
    speak: (id: string) => `/sessions/${id}/speak`,
    iceServers: (id: string) => `/sessions/${id}/ice-servers`,
    webrtc: (id: string) => `/sessions/${id}/webrtc`,
    hint: (id: string) => `/sessions/${id}/hint`,
    repeat: (id: string) => `/sessions/${id}/repeat`,
    confidence: (id: string) => `/sessions/${id}/confidence`,
    note: (id: string) => `/sessions/${id}/note`,
  },
  progress: "/me/progress",
} as const;
