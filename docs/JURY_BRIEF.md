# JURY_BRIEF.md — Read this before any task

You are working on Tkallem, an AI English speaking coach for Algerian students who understand English but freeze when they have to speak it in high-stakes moments (visa, Campus France, remote job interviews, IELTS speaking).

This file explains the situation, the judging criteria, what to fix, and the only 4 improvements we are allowed to add before the deadline. Read it together with `docs/DESIGN.md` and `CLAUDE.md`.

---

## 1. The situation

- This is our team project for the Thirduni programme (Cohort 1, October 2026).
- **Submission platform opens: Thursday 15 October.** We submit a first draft that day, then keep improving it.
- **Hard deadline: Saturday 31 October, 23:59 Algiers time.** Our internal deadline is **29 October**.
- **Judging: 1 to 7 November.** The panel = judges from the **U.S. Embassy** + a guest from a **major Algerian company** bringing real opportunities for the top 3. Results on 9 November.
- **There is no live pitch.** Judges open our live link alone, use the app without us, watch a 2-4 minute demo video, and read our repo.

Consequence for every decision: **a judge must be able to open the app, on a laptop or a phone, and complete a visa interview with corrections and a report, alone, on the first try.**

---

## 2. How we are scored (5 criteria, 20 points each)

| Criterion | What the judges check | What it means for the code |
|---|---|---|
| Problem and insight | Real, narrow problem; evidence we talked to real users | Product must clearly target "I understand but I freeze". Not a code task, but every feature must serve it |
| Working product | A judge opens it and the core feature works end to end | Deployed, stable, works on phone (Android + iPhone Safari), no dead ends, no "coming soon" |
| Technical execution | Clear README, sensible structure, readable code, no secrets, honest about limits | README complete, repo public and clean, tests pass, limits documented |
| Impact and viability | Who it helps, how to reach them, will it continue after October | Cost controls work, credits model clear, "what next" documented |
| Story and demo | Demo video opens with the product and shows real usage | The main flow must look excellent on screen recording |

Tie-break: **Working product** first, then Problem and insight. Reliability beats features.

---

## 3. Rules from now until the deadline

1. **Feature freeze.** No new features except the 4 improvements in section 5. Any other idea goes into `docs/WHAT_NEXT.md`, not into the code.
2. **Never break the core loop:** scenario → speak or type → coach reply → corrections → report.
3. **Run all tests and agent evals before every merge** (API, agent, front, and the correction evals). Current baseline must not regress: 29/29 errors detected, 0 false alerts, 9/9 prompt injections blocked.
4. **"The model talks, the code decides"** stays the rule. Any new LLM output must be validated by code (schema, length, no invented errors, no changed names or numbers).
5. Follow `docs/DESIGN.md`. Do not add colors, fonts or components outside it.
6. Never commit secrets. Keys only in environment variables.
7. Small pull requests, one topic each.

---

## 4. Fixes to do first (priority P0, before 15 October)

| # | Task | Done when |
|---|---|---|
| F-1 | Deploy front (Vercel) and API (Render, Ohio, next to Neon) with HTTPS | A logged-out private window on a phone completes the guest visa interview |
| F-2 | Test on a real Android phone and on iPhone Safari (mic permission, audio autoplay, "Tap to hear the coach" fallback) | Both complete a voice session; issues fixed or documented |
| F-3 | Remove the leaked Clerk key from git history (`git filter-repo`), confirm it is revoked, then make the repo public | `git log -p` search for the key returns nothing |
| F-4 | Hide unfinished parts: remove Groups and Notifications from all menus and routes visible to users | No "coming soon" page reachable |
| F-5 | 3D coach **off by default**, with a toggle to show it; replace or remove the sample avatar | Chat loads without the avatar on mobile |
| F-6 | Simplify the first chat screen for guests: the first coach question is visible within 5 seconds of clicking "Try a visa interview now" | Measured on a phone |
| F-7 | Mobile: show the correction **directly under the student's message** (not in a side panel below the chat) | No scrolling needed to see a correction on a 390 px screen |
| F-8 | Design consistency with `docs/DESIGN.md`: one font everywhere, remove the purple (#5b3fd6) from auth pages, one brand yellow | Visual check of every page |
| F-9 | Clerk: disable "Username", rename the app | Sign-up shows only email or Google |
| F-10 | Judging-week safety: make the daily spend cap configurable by env var, plan to raise it 1-7 Nov, add an alert when 80% is reached | Cap and alert tested |

---

## 5. The 4 improvements (allowed, after P0, target 13-20 October)

These all target the real problem: the student **freezes** when speaking, mostly from **fear of making mistakes**. Each must be small, safe, and covered by tests.

### Improvement 1 — "Help me start" (rescue when the student freezes)

**Why:** today, when the student blocks, the app does nothing. This is the exact moment of our problem.

**Behaviour:**
- A "Help me start" button is always visible under the current coach question (Practice mode only).
- It also appears with a gentle highlight if the student has not started speaking or typing **5 seconds** after the coach finished the question.
- Two options:
  - **Sentence starter:** shows 1 or 2 short openings for the current question, at the student's level. Example: "You can start with: *The main reason I'm going is…*"
  - **Say it in French or Darija:** the student types or says the idea in French or Darija; the coach returns the English version, at their level, for them to read aloud.

**Backend:**
- New endpoint `POST /sessions/{id}/hint` with `{ "type": "starter" }` or `{ "type": "translate", "text": "..." }`.
- Free (no credit), max 2 hints per question, rate-limited.
- Code validation: a starter is at most 12 words and must not be a complete answer; a translation keeps names and numbers unchanged; reject and fall back to a scenario-defined starter if validation fails.
- Each scenario JSON gets 1 fallback starter per question, written by the team.

**Done when:** evals cover 10 starter cases and 10 translation cases (French and Darija), 0 complete-answer starters, 0 changed names or numbers.

### Improvement 2 — "Say it again" (repeat the corrected sentence)

**Why:** reading a correction does not unlock speaking; saying it out loud does.

**Behaviour:**
- Under each correction, a "Say it again" button.
- The student records the corrected sentence. If it matches, the status chip turns green with the word "Nailed it". If not, show the difference gently and allow another try.
- It does not move the interview forward.

**Backend:**
- Reuse transcription. Matching is **decided by code, not by the LLM**: normalize (lowercase, punctuation, contractions), then require token similarity of at least 0.85 and all corrected words present.
- Free, max 3 tries per correction, rate-limited.

**Done when:** unit tests on the matcher (exact, contraction variants, missing corrected word, extra filler words like "um").

### Improvement 3 — Two modes: "Practice" and "Real interview"

**Why:** students build confidence with support first, then train for real pressure.

**Behaviour:**
- Mode chosen when starting a session; default **Practice**.
- **Practice:** corrections after each answer, "Help me start" and "Say it again" available.
- **Real interview:** no corrections, no hints during the session; the coach behaves like a real officer. Everything appears in the report.
- The mode is shown on the chat screen and in the report.

**Backend:** add `feedback_mode` (`practice` | `interview`) to sessions (Alembic migration). Corrections are still computed in both modes; only their display timing changes.

**Done when:** tests confirm no correction or hint is sent to the client during an interview-mode session, and the report contains all of them.

### Improvement 4 — Corrections that reassure before they correct

**Why:** for a student afraid of mistakes, a wall of red makes the freeze worse.

**Behaviour:**
- Each answer's feedback starts with **one short, true positive** ("Your idea was clear.").
- Then **one priority correction** shown in full; the others collapsed under "2 more small fixes".
- Red is used **only** for the "Redo" status, never for a single small mistake.
- The report opens with progress ("You spoke 40 seconds longer than last time") before the mistakes.

**Agent:**
- The corrector output gets two fields: `praise` (max 12 words, must refer to something actually present in the answer) and `priority_index`.
- Code validation: drop the praise if it is generic or mentions something not in the answer; if `priority_index` is invalid, use the first correction.

**Done when:** the existing correction evals still pass unchanged, and a new eval checks praise is never invented on 20 answers.

### Small extra (only if time allows)

- "Repeat slower" button on each coach question (slower TTS rate). Helps students who struggle with listening.

---

## 6. Repo and documentation (before 25 October)

- `README.md`: what Tkallem is (problem in 2 sentences), live link, demo video link, how to run locally (front, API, env vars with an `.env.example`), architecture diagram, tech stack including AI tools used, **who built which part** (one honest line per person), known limits.
- `docs/WHAT_NEXT.md`: plan for the next 3 months (real users, more scenarios, French UI, groups) — max 100 words for the submission version.
- If any earlier work is reused (for example the CEFR model), say so clearly in the README.

---

## 7. What NOT to do

- No new scenarios, badges, groups, notifications, payment, or new languages.
- No avatar work beyond turning it off by default.
- No large refactor.
- No change to the credit system except configuration for judging week.
- Do not touch another owner's folder without a pull request reviewed by them (see `CLAUDE.md`).

---

## 8. Definition of ready for the jury

- [ ] Live link works logged out, on laptop, Android and iPhone
- [ ] Guest visa interview: voice and text, corrections, report, "Practice again"
- [ ] Help me start, Say it again, two modes, reassuring corrections: working and tested
- [ ] All tests and evals green, no regression
- [ ] Repo public, no secrets in history, README complete
- [ ] Spend cap and alert ready for 1-7 November
- [ ] Everything checked in a private window on 30 October
