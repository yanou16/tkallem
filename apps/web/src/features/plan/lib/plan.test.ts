import { describe, expect, it } from "vitest";
import { EMPTY_PLAN, goalFromLabel, goalLabel, isComplete, planOrder, planPath, toggleFocus, toProfileUpdate } from "./plan";

const S = (id: string, category: string | null, mode: "guided" | "free" = "guided") => ({ id, category, mode });
const ALL = [S("visa-us", "travel"), S("campus-france", "study"), S("job-remote", "work"), S("ielts-part2", "exams"),
  S("free-talk", "speaking", "free"), S("taxi", "speaking"), S("shop", "speaking"), S("cafe", "speaking"), S("airport", "travel")];
const ids = (l: { id: string }[]) => l.map((s) => s.id);

describe("planOrder", () => {
  it("puts the goal's situations first, in the goal's order", () => {
    expect(ids(planOrder(ALL, "daily", [])).slice(0, 4)).toEqual(["taxi", "shop", "cafe", "airport"]);
    expect(ids(planOrder(ALL, "ielts", []))[0]).toBe("ielts-part2");
  });
  it("then the liked subjects, then the rest in the original order", () => {
    const order = ids(planOrder(ALL, "job", ["exams"]));
    expect(order.slice(0, 4)).toEqual(["job-remote", "free-talk", "cafe", "shop"]);
    expect(order[4]).toBe("ielts-part2");
    expect(order.slice(5)).toEqual(["visa-us", "campus-france", "taxi", "airport"]);
  });
  it("leaves the list unchanged without goal and interests, and never loses a situation", () => {
    expect(ids(planOrder(ALL, null, []))).toEqual(ids(ALL));
    expect(ids(planOrder(ALL, "visa", ["travel"])).sort()).toEqual(ids(ALL).sort());
  });
});

describe("planPath", () => {
  it("keeps four guided situations at most, no free talk", () => {
    const path = planPath(ALL, "job", []);
    expect(path).toHaveLength(4);
    expect(ids(path)).toEqual(["job-remote", "cafe", "shop", "visa-us"]);
  });
});

describe("answers", () => {
  it("keeps two focus areas at most, and a tap again removes one", () => {
    let f = toggleFocus([], "fluency");
    f = toggleFocus(f, "grammar");
    expect(toggleFocus(f, "vocabulary")).toEqual(["fluency", "grammar"]);
    expect(toggleFocus(f, "fluency")).toEqual(["grammar"]);
  });
  it("is complete with a goal, a level, minutes and one focus (interests are optional)", () => {
    expect(isComplete(EMPTY_PLAN)).toBe(false);
    expect(isComplete({ goal: "visa", level: "B1", minutes: 10, focus: ["fluency"], interests: [] })).toBe(true);
  });
  it("saves only what the profile has a field for, and the goal can be read back", () => {
    const u = toProfileUpdate({ goal: "job", level: "A2", minutes: 15, focus: ["grammar"], interests: ["work"] });
    expect(u).toEqual({ level: "A2", dailyGoalMinutes: 15, learningGoal: goalLabel("job"), focusAreas: ["grammar"] });
    expect(goalFromLabel(u.learningGoal)).toBe("job");
    expect(goalFromLabel("something I typed")).toBeNull();
    expect(goalLabel("daily").length).toBeLessThanOrEqual(200);
  });
});
