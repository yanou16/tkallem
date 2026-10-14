# Impeccable pass 2: summary (15 October 2026)

Scope: eight pages, each critiqued by two isolated sub-agents (A: design review without any detector output; B: detector and scripted audit), before and after a round of small fixes (PRs #68, #69, #70 and this one). Feature freeze respected: fixes only. `bolder`, `delight`, `overdrive` were not used; `colorize` ran in fix mode under `docs/DESIGN.md`.

## Scores (Nielsen, 0 to 4 per heuristic; each score comes from a different reviewer, so read a 1 to 2 point move as noise unless the listed issues changed)
| Page | Pass 1 (single context) | Pass 2 initial | Pass 2 final |
|---|---|---|---|
| Landing | 20/32 | 22/32 | 23/32 |
| Practice | n/a | 27/40 | 28/40 |
| AI Chat | 27/40 | 26/40 | 27/40 |
| Session report | 26/36 | 25/36 | 25/36 |
| Home | n/a | 26/40 | 28/40 |
| Progress | n/a | 26/40 | 28/40 |
| Profile | n/a | 26/40 | 26/40 |
| Sign-in | n/a | 26/40 | 29/40 |

The final reviews ran on the code of PRs #68 to #70. The fixes of the last PR (listed below) answer several of their P1 findings and were not re-scored.

## Scripted audit (Chromium, guest, same script before and after)
- Overflow: none at 375, 320 or 1280 on any captured screen (19 to 21 per width on production).
- Controls under 44px on production: before the work 6 of 17 phone screens (41 controls); after pass 2 fixes 0 on every captured screen at 375, 320 and 1280.
- Text under 14px: removed from running text; what stays is deliberate (13px chips and level badges, 12px bottom navigation labels, the landing demo drawing).
- The 320px chat after an answer: conversation area 221px (it was 146px at the start of pass 2, 33px with the help panel open; now 93px). The 320px overflow found by the final review (the card and the Voice/Text pill reaching the screen edge with Help open) was a grid track without `min-w-0`; fixed and measured at 0 overflowing elements.

## Detector on production pages (guest-reachable)
| Page | Before | After |
|---|---|---|
| /welcome | 31 | 9 (8 nested cards inside the drawn app window, accepted; 1 gray-on-color, fixed by this PR) |
| /sign-in | 3 | 0 |
| /sign-up | 9 | 0 |
| /forgot-password | 2 | 0 |
| /plan, /practice, /groups, /ai-chat | 0 | 0 |
Accepted findings and the detector's limits: `accepted-findings.md`.

## What the fixes were (by command)
- typeset: 28px titles on phones, 14px running text, correction explanations 14px, sizes of the Progress tiles.
- layout: Profile 2 columns and no avatar badge, Practice in two groups (interviews first), Home stat tiles compact on phones, chat header on one row, report freeze card right after the coach's note.
- clarify: "answers" instead of "credits", "Work on this one first" (it only scrolls, it does not retry), neutral confidence banner unless the student feels more confident, honest Home link, plain empty states.
- harden: Progress and Sign-in empty and error states, sign-in button disabled until Clerk is ready, dialog close target, no long unbroken text overflow.
- adapt: 320px chat (grid `min-w-0`, compact EN/FR toggle and End button, no avatars and 0/500 counter until 400 characters on phones).
- distill: removed the sign-in decoration (faces, bubbles, violet, blobs), the dead AuthFrame, the empty hesitation card on typed sessions, duplicate Profile photo entry.
- colorize (fix mode): no violet, the retired pastels removed, scenario tints calmed (contrast table in docs/DESIGN.md), yellow only on logo marks, the mic ring and the PWA theme, every text on a tint charcoal or slate (never steel), placeholders 5.0:1, a test (`design-tokens.test.ts`) guards all of it.
- polish: logo weights 600, no shadow outside menus and dialogs, landing hero (promise first, visa interview as a visible button).

## Not verified
- Pages behind sign-in (Home, Progress, Profile) were judged from localhost with the same code as a guest, not on production.
- No real phone, no screen reader, no 200% zoom, no soft keyboard open.
- The final reviews could not verify: the help panel at 375 (capture identical to the previous step), the report at 320 after the final fixes, desktop data states of Progress.
- Deliberately not changed (feature freeze or too large for a small PR): mobile credit pill without the word "answers" (the header does not have the room at 375), a discard option for a recording, a confirmation before "End session" and before switching scenario, the "Answer mode" toggle label, French labels for the interface chrome.
