---
target: Landing page
total_score: 20
max_score: 32
na_heuristics: 7,10
p0_count: 0
p1_count: 5
target_identity: "file:/Users/yanou/Projects/tkallem/apps/web/src/app/welcome/page.tsx"
target_fingerprint: "sha256:4488b83208b3e99318ced3bf45ee544ee42bbabd6bc8d68e06d788b87856f8f4"
target_path: /Users/yanou/Projects/tkallem/apps/web/src/app/welcome/page.tsx
timestamp: 2026-10-14T17-08-08Z
slug: apps-web-src-app-welcome-page-tsx
---
⚠️ DEGRADED: single-context (the session policy does not allow spawning the two isolated sub-agents; Assessment A was written from screenshots and source before reading the detector output, then Assessment B was run and merged)

# Critique: landing (/welcome)

Mode: Persuade. Heuristics 7 and 10 scored n/a (landing page). Score is out of 32.

## Design Health Score
| # | Heuristic | Score | Key issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | The guided tour says what is lit and why; "Example data. It spends nothing" is honest. |
| 2 | Match System / Real World | 4 | "You know English. Stop freezing when you have to speak it." is the students' own problem, in their words. |
| 3 | User Control and Freedom | 3 | The tour stops at the first touch and never plays under reduced motion; "Or try a visa interview right away" keeps a direct exit. |
| 4 | Consistency and Standards | 2 | "Continue practising" / "Practise in this order" (UK) next to "Practice" (US); "credits" in the header pill vs "free answers" in the copy. |
| 5 | Error Prevention | 3 | No form on the page; the plan flow has a Skip. |
| 6 | Recognition Rather Than Recall | 3 | Every label sits next to the part it explains. |
| 7 | Flexibility and Efficiency | n/a | Persuade surface. |
| 8 | Aesthetic and Minimalist Design | 2 | The demo shows up to 9 captions and a full dashboard; each scenario card carries an icon tile that repeats the title; the demo mock nests cards in a browser frame. |
| 9 | Error Recovery | 3 | If scenarios fail to load a link to the visa interview remains. |
| 10 | Help and Documentation | n/a | Persuade surface. |
| **Total** | | **20/32** | Good |

## Design Specificity Verdict
Specific to the product: the coloured hero example (visa tint, green praise, amber fix, "3.4 s before you speak", "Nailed it") could not belong to another product. The scenario cards are the weakest part: an icon tile plus a title plus an arrow on a pastel is category-interchangeable.

## Deterministic scan
- Source (`impeccable detect --json src/`): 1 finding, `side-tab` (`border-l-4`) in the demo's correction card (PlatformPages.tsx:114). It mirrors the real correction card of DESIGN.md, so it is a known, accepted pattern.
- Live URL (https://tkallem.vercel.app/welcome): 32 findings. 21 `low-contrast` are mostly the tour's own dimming of non-lit regions (opacity .3, intentional, transient) but one is real: `#6b6f7e` on `#fff1d6` = 4.48:1 (needs 4.5:1) in the hero example (the French explanation under the amber fix). 9 `nested-cards` all inside the demo mock. 1 `tiny-text` (11px, mock content).

## Overall Impression
A clear message and a convincing demo. The page spends its budget well. The weak points are consistency of wording and a few decorative repetitions.

## What's Working
1. One message, one picture, one action (hero).
2. The tour lights the exact part a caption talks about, and the plan preview runs the real ordering code.
3. Honest trust line: "No account needed · 40 free answers · Works on your phone".

## Priority Issues
- **P1 Wording is not consistent**: "credits" (header pill, out-of-credits screen) vs "answers" (landing), and British "practise/practising" in 8 places. Fix: say "answers" everywhere, US spelling everywhere.
- **P1 Contrast 4.48:1** on amber (hero example French line). Fix: use charcoal/slate on warn-bg.
- **P2 Icon tiles on scenario cards** repeat the title and add a second visual layer. Fix: remove the tile, keep title, description, duration and level.
- **P2 Nested cards inside the demo mock** read as noise at small size. Fix: flat rows inside the mock frames.
- **P2 Small text (11 to 13px)** in the mock mirrors real UI but is read as body text by assistive tech and by the detector. Fix: keep mock text at 12px minimum only for pure illustration, never for controls.

## Persona red flags
- A stressed student on a low-end Android phone: 9 captions on the platform tab is a lot; the tour helps but the cards under the mock are many.
- A judge opening the link alone: the hero button leads to a 5-question plan before any practice; "Or try a visa interview right away" is the escape and should stay visible.

## Questions skipped
Questions skipped: the scope is fixed by the project brief (8 listed fixes, feature freeze), 5 priority issues already map to items (2), (3), (4), (7).
