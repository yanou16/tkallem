import { describe, expect, it } from "vitest";
import { scenarioTint } from "./tint";

describe("scenarioTint", () => {
  it("gives each kind of scenario its own tint", () => {
    expect(scenarioTint("travel")).toBe("bg-tint-visa");
    expect(scenarioTint("study")).toBe("bg-tint-campus");
    expect(scenarioTint("work")).toBe("bg-tint-job");
    expect(scenarioTint("exams")).toBe("bg-tint-ielts");
  });

  it("keeps any other scenario on the quiet surface, never a borrowed tint", () => {
    expect(scenarioTint("speaking")).toBe("bg-surface");
    expect(scenarioTint(undefined)).toBe("bg-surface");
    expect(scenarioTint(null)).toBe("bg-surface");
    expect(scenarioTint("")).toBe("bg-surface");
  });
});
