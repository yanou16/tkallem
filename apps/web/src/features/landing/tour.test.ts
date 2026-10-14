import { describe, expect, it } from "vitest";
import { CALLOUTS, DEFAULTS, INITIAL_PLAN, PLAN_STEPS, REGIONS, TABS, planReducer, planView } from "./tour";

describe("tabs and captions", () => {
  it("has three tabs, each with captions on both sides", () => {
    expect(TABS.map((t) => t.id)).toEqual(["platform", "plan", "voice"]);
    for (const t of TABS) expect(new Set(CALLOUTS[t.id].map((c) => c.side))).toEqual(new Set(["left", "right"]));
  });
  it("points every caption at a part the preview renders, with unique ids per tab", () => {
    for (const t of TABS) {
      const ids = CALLOUTS[t.id].map((c) => c.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const c of CALLOUTS[t.id]) expect(REGIONS[t.id]).toContain(c.region);
    }
  });
});

describe("the plan preview", () => {
  it("moves on after a single choice, and keeps two focus areas at most", () => {
    let s = planReducer(INITIAL_PLAN, { type: "goal", value: "daily" });
    expect(s.step).toBe(1);
    s = planReducer(s, { type: "level", value: "B1" });
    s = planReducer(s, { type: "minutes", value: 15 });
    expect(s.step).toBe(3);
    for (const f of ["fluency", "grammar", "vocabulary"] as const) s = planReducer(s, { type: "focus", value: f });
    expect(s.focus).toEqual(["fluency", "grammar"]);
    s = planReducer(s, { type: "next" });
    s = planReducer(s, { type: "next" });
    expect(s.step).toBe(PLAN_STEPS);
  });
  it("goes back, and never below the first question", () => {
    expect(planReducer(INITIAL_PLAN, { type: "back" }).step).toBe(0);
    expect(planReducer({ ...INITIAL_PLAN, step: 2 }, { type: "back" }).step).toBe(1);
  });
  it("answering the goal again from the first question moves to the second", () => {
    expect(planReducer({ ...INITIAL_PLAN, step: 0 }, { type: "goal", value: "job" }).step).toBe(1);
    expect(planReducer({ ...INITIAL_PLAN, step: 3, goal: "visa" }, { type: "goal", value: "job" }).step).toBe(3);
  });
  it("finishing fills what was not answered, and reset starts over", () => {
    const s = planReducer(INITIAL_PLAN, { type: "finish" });
    expect(s).toMatchObject({ step: PLAN_STEPS, goal: DEFAULTS.goal, level: DEFAULTS.level, minutes: DEFAULTS.minutes, focus: DEFAULTS.focus });
    expect(planReducer(s, { type: "reset" })).toEqual(INITIAL_PLAN);
  });
  it("orders the situations with the real plan code: the goal decides which come first, four at most", () => {
    const daily = planView({ ...INITIAL_PLAN, goal: "daily" }).path.map((s) => s.id);
    expect(daily).toEqual(["taxi", "shop", "cafe", "airport"]);
    const visa = planView(INITIAL_PLAN).path.map((s) => s.id);
    expect(visa).toEqual(["visa-us", "visa-business", "airport", "taxi"]);
    const ielts = planView({ ...INITIAL_PLAN, goal: "ielts" }).path;
    expect(ielts[0].id).toBe("ielts-part2");
    expect(ielts.every((s) => s.mode === "guided")).toBe(true);
  });
});
