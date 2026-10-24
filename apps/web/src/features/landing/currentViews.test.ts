import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import ProgressView from "@/features/progress/components/ProgressView";
import ProfileView from "@/features/profile/components/ProfileView";
import { PREVIEW_PROGRESS, PREVIEW_BADGES } from "./previewData";
const query = <T,>(data: T) => ({ data, error: null, isLoading: false, refetch: () => {} });
describe("current app views in the welcome tour", () => {
 it("renders actual progress metrics and the regions referenced by callouts", () => {
  const html = renderToStaticMarkup(createElement(ProgressView, { q: query(PREVIEW_PROGRESS) }));
  expect(html).toContain("Small steps. Real progress.");
  expect(html).toContain("Voice practice metrics");
  for (const region of ["metrics", "voice", "top"]) expect(html).toContain(`data-region="${region}"`);
  expect(html).not.toContain("Time before you speak");
 });
 it("renders actual profile cards and anonymous example data", () => {
  const html = renderToStaticMarkup(createElement(ProfileView, {
   user: { firstName: "User", email: "", level: "B1", explainLang: "en", dailyGoalMinutes: 10, learningGoal: "Travel", practiceMode: "both", focusAreas: ["fluency"] },
   sessions: query([]), achievements: query(PREVIEW_BADGES),
  }));
  for (const region of ["setup", "lang", "focus", "badges"]) expect(html).toContain(`data-region="${region}"`);
  expect(html).toContain("Preferred practice mode");
  expect(html).toContain("Account settings");
  expect(html).toContain("User");
  expect(html).not.toContain("Amina");
 });
});
