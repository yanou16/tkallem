import { api } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type { ActiveTopic, GroupDetail, GroupFilters, GroupPost, GroupSession, GroupSummary } from "../types/groups";

const MOCK_GROUPS: GroupSummary[] = [
  {
    id: "1",
    name: "English Fluency & Debate",
    memberCount: 142,
    language: { code: "en", name: "English" },
    levelRange: "B2 – C1",
    description: "Weekly live discussions on global events, technology, and philosophy. Perfect for refining your argumentation and spontaneous speaking.",
    tags: ["Debate", "Fluency", "Advanced"],
    memberAvatars: [
      { id: "u1", name: "Amine K.", avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80" },
      { id: "u2", name: "Sara M.", avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80" },
      { id: "u3", name: "Karim B.", avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80" },
      { id: "u4", name: "Yasmine T.", avatarUrl: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&auto=format&fit=crop&q=80" },
    ],
    isMember: true,
    hasVoiceRoom: true,
  },
  {
    id: "2",
    name: "IELTS Speaking 7.5+ Club",
    memberCount: 98,
    language: { code: "en", name: "English" },
    levelRange: "B1 – B2",
    description: "Daily mock tests for Part 1, 2, and 3. Peer reviews, vocabulary boosters, and cue card strategy sessions for academic and general IELTS.",
    tags: ["IELTS", "Exam Prep", "Speaking"],
    memberAvatars: [
      { id: "u5", name: "Mehdi L.", avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80" },
      { id: "u6", name: "Lina R.", avatarUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&auto=format&fit=crop&q=80" },
      { id: "u7", name: "Walid C.", avatarUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&auto=format&fit=crop&q=80" },
    ],
    isMember: false,
    isExamPrep: true,
    hasVoiceRoom: true,
  },
  {
    id: "3",
    name: "Business English & Career",
    memberCount: 86,
    language: { code: "en", name: "English" },
    levelRange: "B1 – C1",
    description: "Prepare for high-stakes interviews, presentations, pitches, and executive email writing with working professionals.",
    tags: ["Business", "Career", "Interviews"],
    memberAvatars: [
      { id: "u8", name: "Sofiane H.", avatarUrl: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=100&auto=format&fit=crop&q=80" },
      { id: "u9", name: "Nadia D.", avatarUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&auto=format&fit=crop&q=80" },
    ],
    isMember: false,
    hasVoiceRoom: true,
  },
  {
    id: "4",
    name: "Everyday Conversation & Slang",
    memberCount: 215,
    language: { code: "en", name: "English" },
    levelRange: "A2 – B1",
    description: "Relaxed, judgment-free voice rooms. We talk about movies, music, daily routines, and idiomatic expressions to build confidence.",
    tags: ["Casual", "Pronunciation", "Daily Life"],
    memberAvatars: [
      { id: "u10", name: "Ryad K.", avatarUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&auto=format&fit=crop&q=80" },
      { id: "u11", name: "Ines G.", avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80" },
      { id: "u12", name: "Tarik B.", avatarUrl: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=100&auto=format&fit=crop&q=80" },
    ],
    isMember: false,
    hasVoiceRoom: false,
  },
  {
    id: "5",
    name: "Travelers & Nomads Lounge",
    memberCount: 64,
    language: { code: "en", name: "English" },
    levelRange: "A1 – B2",
    description: "Practice airport check-ins, ordering food, booking hotels, and exchanging cultural stories with frequent travelers.",
    tags: ["Travel", "Culture", "Casual"],
    memberAvatars: [
      { id: "u13", name: "Farah S.", avatarUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&auto=format&fit=crop&q=80" },
      { id: "u14", name: "Adel N.", avatarUrl: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&auto=format&fit=crop&q=80" },
    ],
    isMember: false,
    hasVoiceRoom: true,
  },
  {
    id: "6",
    name: "Tech & Software Devs in English",
    memberCount: 110,
    language: { code: "en", name: "English" },
    levelRange: "B2 – C2",
    description: "Discuss system design, machine learning, pull requests, and practice technical interview communication in English.",
    tags: ["Tech", "Engineering", "Debate"],
    memberAvatars: [
      { id: "u15", name: "Anis M.", avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80" },
      { id: "u16", name: "Selma A.", avatarUrl: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=100&auto=format&fit=crop&q=80" },
    ],
    isMember: false,
    hasVoiceRoom: true,
  },
];

const MOCK_UPCOMING_SESSIONS: GroupSession[] = [
  {
    id: "s1",
    groupId: "2",
    groupName: "IELTS Speaking 7.5+ Club",
    title: "Part 2 Cue Cards Mock Exam",
    startsAt: new Date(Date.now() + 3600000 * 2).toISOString(),
    startsAtLabel: "Today at 20:00",
    durationMinutes: 45,
    icon: "message-circle",
  },
  {
    id: "s2",
    groupId: "1",
    groupName: "English Fluency & Debate",
    title: "AI & Human Creativity Debate",
    startsAt: new Date(Date.now() + 3600000 * 6).toISOString(),
    startsAtLabel: "Tomorrow at 18:30",
    durationMinutes: 60,
    icon: "sparkles",
  },
  {
    id: "s3",
    groupId: "3",
    groupName: "Business English & Career",
    title: "Tech Job Interview Simulation",
    startsAt: new Date(Date.now() + 3600000 * 24).toISOString(),
    startsAtLabel: "Wednesday at 19:00",
    durationMinutes: 40,
    icon: "briefcase",
  },
];

const MOCK_TOPICS: ActiveTopic[] = [
  { id: "t1", name: "Job Interviews & Salary Negotiation", conversationCount: "38", trend: "+24% this week" },
  { id: "t2", name: "AI Tools & Productive Workflows", conversationCount: "29", trend: "Trending" },
  { id: "t3", name: "Overcoming Speaking Anxiety", conversationCount: "24", trend: "+15% this week" },
  { id: "t4", name: "Everyday Idioms & Slang", conversationCount: "19", trend: "Popular" },
];

const MOCK_POSTS: Record<string, GroupPost[]> = {
  default: [
    {
      id: "p1",
      author: { id: "u1", name: "Amine K.", avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80" },
      createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
      body: "Welcome to all new members! What is your main speaking goal for this week? Personally, I am trying to eliminate filler words like 'you know' and 'like'.",
      likeCount: 14,
      commentCount: 6,
      likedByMe: true,
    },
    {
      id: "p2",
      author: { id: "u2", name: "Sara M.", avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80" },
      createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
      body: "Loved today's voice room! The discussion on remote work vs office work brought up so many great arguments. See you in the next session!",
      likeCount: 9,
      commentCount: 2,
      likedByMe: false,
    },
  ],
};

function filterMockGroups(f: GroupFilters): GroupSummary[] {
  let list = [...MOCK_GROUPS];
  if (f.search) {
    const q = f.search.toLowerCase();
    list = list.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        g.description.toLowerCase().includes(q) ||
        g.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }
  if (f.language) list = list.filter((g) => g.language.name === f.language);
  if (f.level) list = list.filter((g) => g.levelRange === f.level);
  if (f.topic) list = list.filter((g) => g.tags.includes(f.topic!));
  if (f.voiceRooms) list = list.filter((g) => g.hasVoiceRoom);
  if (f.examPrep) list = list.filter((g) => g.isExamPrep);
  return list;
}

export const getGroups = async (f: GroupFilters): Promise<GroupSummary[]> => {
  try {
    const res = await api.get<GroupSummary[]>(endpoints.groups.list, { query: { ...f } });
    if (res && res.length > 0) return res;
  } catch {}
  return filterMockGroups(f);
};

export const getSuggestedGroups = async (): Promise<GroupSummary[]> => {
  try {
    const res = await api.get<GroupSummary[]>(endpoints.groups.suggested);
    if (res && res.length > 0) return res;
  } catch {}
  return MOCK_GROUPS.slice(0, 3);
};

export const getUpcomingSessions = async (): Promise<GroupSession[]> => {
  try {
    const res = await api.get<GroupSession[]>(endpoints.groups.upcomingSessions);
    if (res && res.length > 0) return res;
  } catch {}
  return MOCK_UPCOMING_SESSIONS;
};

export const getActiveTopics = async (): Promise<ActiveTopic[]> => {
  try {
    const res = await api.get<ActiveTopic[]>(endpoints.groups.activeTopics);
    if (res && res.length > 0) return res;
  } catch {}
  return MOCK_TOPICS;
};

export const getGroup = async (id: string): Promise<GroupDetail> => {
  try {
    const res = await api.get<GroupDetail>(endpoints.groups.detail(id));
    if (res && res.id) return res;
  } catch {}

  const base = MOCK_GROUPS.find((g) => g.id === id) ?? MOCK_GROUPS[0];
  return {
    ...base,
    createdAt: "2024-01-10T12:00:00Z",
    topics: base.tags,
    levelLabel: base.levelRange,
    todayTopic: {
      title: "How does technology change the way we communicate?",
      description: "Share your thoughts on whether instant messaging makes our relations stronger or shallower.",
    },
    liveVoiceRoom: base.hasVoiceRoom
      ? {
          id: `vr-${base.id}`,
          title: `${base.name} - Open Floor`,
          participantCount: 3,
          isOpen: true,
          participants: base.memberAvatars.slice(0, 3),
        }
      : null,
    nextSession: MOCK_UPCOMING_SESSIONS.find((s) => s.groupId === base.id) ?? null,
    moderators: [
      { id: "mod1", name: "Amine K.", role: "Lead Host", avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80" },
    ],
  };
};

export const getGroupPosts = async (id: string): Promise<GroupPost[]> => {
  try {
    const res = await api.get<GroupPost[]>(endpoints.groups.posts(id));
    if (res && res.length > 0) return res;
  } catch {}
  return MOCK_POSTS[id] ?? MOCK_POSTS.default;
};

export const getGroupSessions = async (id: string): Promise<GroupSession[]> => {
  try {
    const res = await api.get<GroupSession[]>(endpoints.groups.sessions(id));
    if (res && res.length > 0) return res;
  } catch {}
  return MOCK_UPCOMING_SESSIONS.filter((s) => s.groupId === id);
};

export const joinGroup = async (id: string): Promise<void> => {
  try {
    await api.post(endpoints.groups.join(id));
  } catch {}
  const target = MOCK_GROUPS.find((g) => g.id === id);
  if (target) {
    target.isMember = true;
    target.memberCount += 1;
  }
};

export const leaveGroup = async (id: string): Promise<void> => {
  try {
    await api.post(endpoints.groups.leave(id));
  } catch {}
  const target = MOCK_GROUPS.find((g) => g.id === id);
  if (target) {
    target.isMember = false;
    target.memberCount = Math.max(0, target.memberCount - 1);
  }
};

export const createPost = async (id: string, body: string): Promise<GroupPost> => {
  try {
    return await api.post<GroupPost>(endpoints.groups.posts(id), { body });
  } catch {}
  const newPost: GroupPost = {
    id: `post-${Date.now()}`,
    author: { id: "me", name: "You" },
    createdAt: new Date().toISOString(),
    body,
    likeCount: 0,
    commentCount: 0,
    likedByMe: false,
  };
  if (!MOCK_POSTS[id]) MOCK_POSTS[id] = [...(MOCK_POSTS.default ?? [])];
  MOCK_POSTS[id].unshift(newPost);
  return newPost;
};

export const likePost = async (id: string, postId: string): Promise<void> => {
  try {
    await api.post(endpoints.groups.likePost(id, postId));
  } catch {}
};

export const setSessionReminder = async (id: string, sessionId: string): Promise<void> => {
  try {
    await api.post(endpoints.groups.sessionReminder(id, sessionId));
  } catch {}
};
