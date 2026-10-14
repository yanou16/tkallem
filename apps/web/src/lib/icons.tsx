import {
  BriefcaseBusiness, Plane, Utensils, GraduationCap, Stethoscope, MessageCircle, Users, Laptop, BookOpen,
  Target, Mic, Flame, Trophy, Globe, Sparkles, FileText, ChartNoAxesColumn, TriangleAlert, Sprout, Video,
  Briefcase, UserRound, Languages, Star, Bell, Megaphone, Car, ShoppingBag, Coffee, PlaneTakeoff, type LucideIcon,
} from "lucide-react";

/** Backend sends icon identifiers (strings). The frontend owns the mapping to components. */
const map: Record<string, LucideIcon> = {
  briefcase: BriefcaseBusiness, work: Briefcase, travel: Plane, plane: Plane, restaurant: Utensils,
  university: GraduationCap, exam: GraduationCap, exams: GraduationCap, doctor: Stethoscope, health: Stethoscope,
  chat: MessageCircle, speaking: MessageCircle, group: Users, users: Users, people: UserRound, laptop: Laptop,
  book: BookOpen, vocabulary: BookOpen, grammar: FileText, target: Target, mic: Mic, pronunciation: Mic,
  flame: Flame, streak: Flame, trophy: Trophy, globe: Globe, sparkles: Sparkles, chart: ChartNoAxesColumn,
  warning: TriangleAlert, growth: Sprout, video: Video, languages: Languages, star: Star, bell: Bell, megaphone: Megaphone,
  taxi: Car, shop: ShoppingBag, cafe: Coffee, airport: PlaneTakeoff,
  // Scenario ids: scenarios come without an icon, so the frontend picks one per scenario.
  "visa-us": Plane, "campus-france": GraduationCap, "job-remote": Laptop, "ielts-part2": Mic, "free-talk": MessageCircle,
};

export function getIcon(name?: string): LucideIcon {
  return (name && map[name.toLowerCase()]) || MessageCircle; // DESIGN.md: no sparkle icons
}
export function Icon({ name, className, size = 20 }: { name?: string; className?: string; size?: number }) {
  const C = getIcon(name);
  return <C className={className} size={size} strokeWidth={1.8} aria-hidden />;
}
