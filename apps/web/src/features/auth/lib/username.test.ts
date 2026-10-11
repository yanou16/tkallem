import { describe, expect, it } from "vitest";
import { completeUsername, usernameFrom } from "./username";

const fixed = () => 0.5; // suffix 5500

describe("usernameFrom", () => {
  it("makes a Clerk username from the e-mail", () => {
    expect(usernameFrom("Rayane.Louz@gmail.com", fixed)).toBe("rayane_louz_5500");
    expect(usernameFrom("Médéa.étudiant@x.dz", fixed)).toBe("medea_etudiant_5500");
    expect(usernameFrom("", fixed)).toBe("student_5500");
    expect(usernameFrom(null, fixed)).toBe("student_5500");
    expect(usernameFrom("a".repeat(80) + "@x.com")).toMatch(/^a{40}_\d{4}$/);
  });
});

type Step = "ok" | "taken" | "more";

/** A Clerk sign-up that only misses a username; each update() call does the next step. */
function fakeSignUp(steps: Step[]) {
  const calls: string[] = [];
  const make = (status: string, missing: string[]): any => ({
    status,
    missingFields: missing,
    emailAddress: "sara@gmail.com",
    firstName: "Sara",
    createdSessionId: status === "complete" ? "sess_1" : null,
    async update({ username }: { username: string }) {
      calls.push(username);
      const step = steps.shift();
      if (step === "taken") throw { errors: [{ code: "form_identifier_exists" }] };
      if (step === "more") return make("missing_requirements", ["phone_number"]);
      return make("complete", []);
    },
  });
  return { signUp: make("missing_requirements", ["username"]), calls };
}

describe("completeUsername", () => {
  it("completes a sign-up that only misses a username", async () => {
    const { signUp, calls } = fakeSignUp(["ok"]);
    await expect(completeUsername(signUp)).resolves.toBe("sess_1");
    expect(calls[0]).toMatch(/^sara_\d{4}$/);
  });

  it("tries another username when one is taken", async () => {
    const { signUp, calls } = fakeSignUp(["taken", "ok"]);
    await expect(completeUsername(signUp)).resolves.toBe("sess_1");
    expect(calls).toHaveLength(2);
  });

  it("does not invent other missing fields: the caller shows an error", async () => {
    const signUp: any = { status: "missing_requirements", missingFields: ["username", "phone_number"], async update() { throw new Error("must not be called"); } };
    await expect(completeUsername(signUp)).resolves.toBeNull();
  });

  it("returns the session of a sign-up that is already complete", async () => {
    await expect(completeUsername({ status: "complete", createdSessionId: "s2", missingFields: [] } as any)).resolves.toBe("s2");
  });

  it("raises an unexpected Clerk error instead of hiding it", async () => {
    const signUp: any = { status: "missing_requirements", missingFields: ["username"], emailAddress: "a@b.c", async update() { throw { errors: [{ code: "network" }] }; } };
    await expect(completeUsername(signUp)).rejects.toBeTruthy();
  });
});
