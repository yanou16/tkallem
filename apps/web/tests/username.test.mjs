// node --test tests/   (Node 22.6+ runs the TypeScript helper directly)
import { test } from "node:test";
import assert from "node:assert/strict";
import { completeUsername, usernameFrom } from "../src/features/auth/lib/username.ts";

const fixed = () => 0.5; // suffix 5500

test("username is made from the e-mail, cleaned for Clerk", () => {
  assert.equal(usernameFrom("Rayane.Louz@gmail.com", fixed), "rayane_louz_5500");
  assert.equal(usernameFrom("Médéa.étudiant@x.dz", fixed), "medea_etudiant_5500");
  assert.equal(usernameFrom("", fixed), "student_5500");
  assert.equal(usernameFrom(null, fixed), "student_5500");
  assert.match(usernameFrom("a".repeat(80) + "@x.com"), /^a{40}_\d{4}$/);
});

function fakeSignUp(steps) {
  // steps: what each update() call does, in order ("ok" -> complete, "taken" -> Clerk error, "more" -> still missing)
  const calls = [];
  const make = (status, missing) => ({
    status, missingFields: missing, emailAddress: "sara@gmail.com", firstName: "Sara",
    createdSessionId: status === "complete" ? "sess_1" : null,
    async update({ username }) {
      calls.push(username);
      const step = steps.shift();
      if (step === "taken") throw { errors: [{ code: "form_identifier_exists" }] };
      if (step === "more") return make("missing_requirements", ["phone_number"]);
      return make("complete", []);
    },
  });
  return { signUp: make("missing_requirements", ["username"]), calls };
}

test("a sign-up that only misses a username is completed", async () => {
  const { signUp, calls } = fakeSignUp(["ok"]);
  assert.equal(await completeUsername(signUp), "sess_1");
  assert.match(calls[0], /^sara_\d{4}$/);
});

test("a taken username is retried with another one", async () => {
  const { signUp, calls } = fakeSignUp(["taken", "ok"]);
  assert.equal(await completeUsername(signUp), "sess_1");
  assert.equal(calls.length, 2);
});

test("other missing fields are not invented: the caller shows an error", async () => {
  const s = { status: "missing_requirements", missingFields: ["username", "phone_number"], async update() { throw new Error("must not be called"); } };
  assert.equal(await completeUsername(s), null);
});

test("an already complete sign-up just returns its session", async () => {
  assert.equal(await completeUsername({ status: "complete", createdSessionId: "s2", missingFields: [] }), "s2");
});

test("an unexpected Clerk error is raised, not swallowed", async () => {
  const s = { status: "missing_requirements", missingFields: ["username"], emailAddress: "a@b.c", async update() { throw { errors: [{ code: "network" }] }; } };
  await assert.rejects(completeUsername(s));
});
