import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/client";
import { checkError, closedReason, correctionLabel, memberName, reportError, sendError } from "./labels";

describe("correctionLabel", () => {
  it("shows the rule when the corrector gave one", () => {
    expect(correctionLabel({ rule: "verb_pattern", type: "grammar" })).toBe("Verb patterns");
    expect(correctionLabel({ rule: "preposition", type: "grammar" })).toBe("Prepositions");
  });

  it("shows the type when the rule is null", () => {
    expect(correctionLabel({ rule: null, type: "vocabulary" })).toBe("Vocabulary");
    expect(correctionLabel({ rule: null, type: "word_choice" })).toBe("Word choice");
  });

  it("shows a rule the front does not know yet as the API sent it", () => {
    expect(correctionLabel({ rule: "new_rule", type: "grammar" })).toBe("new_rule");
  });
});

describe("memberName", () => {
  it("says You for her, the first name for the others, Member when there is none", () => {
    expect(memberName({ id: 1, firstName: "Amina" }, true)).toBe("You");
    expect(memberName({ id: 2, firstName: "Yacine" })).toBe("Yacine");
    expect(memberName({ id: 3, firstName: null })).toBe("Member");
    expect(memberName({ id: 4, firstName: "  " })).toBe("Member");
  });
});

const fail = (status: number, message = "from the API") => new ApiError(message, status);

describe("error messages", () => {
  it("sending: 429 says to wait, the limit is 20 a minute", () => {
    expect(sendError(fail(429))).toMatch(/20 messages in the last minute/);
    expect(sendError(fail(403))).toMatch(/no longer a member/);
  });

  it("checking: 429 is the 30 checks of 24 hours, 502 the model being unavailable", () => {
    expect(checkError(fail(429))).toMatch(/30 checks of the last 24 hours/);
    expect(checkError(fail(502))).toMatch(/not available right now/);
  });

  it("reporting: twice, or her own message", () => {
    expect(reportError(fail(409))).toMatch(/already reported/);
    expect(reportError(fail(403))).toMatch(/other members' messages/);
  });

  it("anything else: the API's own message, or a general one without a status", () => {
    expect(sendError(fail(500, "Server error"))).toBe("Server error");
    expect(checkError(new Error("boom"))).toBe("Something went wrong. Try again.");
  });

  it("live updates stopped for good: says why", () => {
    expect(closedReason(4403)).toMatch(/no longer a member/);
    expect(closedReason(4404)).toMatch(/no longer exists/);
    expect(closedReason(4401)).toMatch(/expired/);
  });
});
