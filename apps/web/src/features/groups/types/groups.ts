export type Person = { id: string; name: string; avatarUrl?: string; online?: boolean };

export type GroupSummary = {
  id: string;
  name: string;
  memberCount: number;
  language: { code: string; name: string; flagUrl?: string };
  levelRange: string; // "A2 – B1"
  description: string;
  tags: string[];
  memberAvatars: Person[];
  isMember: boolean;
  hasVoiceRoom?: boolean;
  isExamPrep?: boolean;
};

export type GroupSession = {
  id: string;
  groupId: string;
  groupName?: string;
  title: string;
  startsAt: string; // ISO
  startsAtLabel?: string; // optional pre-formatted by backend (timezone aware)
  durationMinutes: number;
  icon?: string;
  hasReminder?: boolean;
  isMember?: boolean;
};

export type ActiveTopic = { id: string; name: string; conversationCount: string; trend: string };

export type Moderator = Person & { role?: string };

export type GroupDetail = GroupSummary & {
  imageUrl?: string;
  createdAt: string;
  topics: string[];
  levelLabel?: string;
  todayTopic?: { title: string; description?: string } | null;
  liveVoiceRoom?: {
    id: string;
    title: string;
    participantCount: number;
    isOpen: boolean;
    participants: Person[];
  } | null;
  nextSession?: GroupSession | null;
  moderators: Moderator[];
};

export type GroupPost = {
  id: string;
  author: Person;
  createdAt: string;
  body: string;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
};

export type GroupFilters = {
  search?: string;
  language?: string;
  level?: string;
  topic?: string;
  voiceRooms?: boolean;
  examPrep?: boolean;
};
