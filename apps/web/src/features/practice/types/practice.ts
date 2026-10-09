export type Scenario = {
  id: string;
  title: string;
  subtitle?: string;
  description: string;
  duration: number; // minutes
  level: string;
  category: string; // speaking | vocabulary | grammar | exams | work | travel ...
  icon: string; // identifier mapped to a Lucide icon in lib/icons.tsx
};

export type RecentSession = {
  id: string;
  scenarioId: string;
  title: string;
  subtitle: string; // e.g. "You were practicing introductions."
  duration: number;
  level: string;
  icon: string;
};

export type PracticeFocus = {
  scenarioId?: string;
  title: string;
  description: string;
  reason: string;
  icon: string;
};
