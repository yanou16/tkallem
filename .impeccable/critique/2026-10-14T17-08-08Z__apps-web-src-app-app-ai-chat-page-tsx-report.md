---
target: Session report
total_score: 26
max_score: 36
na_heuristics: 7
p0_count: 0
p1_count: 4
target_identity: "file:/Users/yanou/Projects/tkallem/apps/web/src/app/(app)/ai-chat/page.tsx#report"
timestamp: 2026-10-14T17-08-08Z
slug: apps-web-src-app-app-ai-chat-page-tsx-report
---
⚠️ DEGRADED: single-context (the session policy does not allow spawning the two isolated sub-agents; Assessment A was written from screenshots (desktop and phone) of a real 6-answer session and the source of the Report component)

# Critique: session report (end of /ai-chat)

Mode: Read/Operate. Heuristic 7 scored n/a. Score is out of 36.

## Design Health Score
| # | Heuristic | Score | Key issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | "First interview done: this is your starting point." says where the student is. |
| 2 | Match System / Real World | 3 | "Time before you write/speak" names the freeze in plain words. |
| 3 | User Control and Freedom | 3 | Practice again / Back to practice are clear. |
| 4 | Consistency and Standards | 3 | Same status words as the chat (Clean, 2 fixes). |
| 5 | Error Prevention | 3 | n/a risks; confidence ask is skippable. |
| 6 | Recognition Rather Than Recall | 3 | Each answer keeps its sentence, status and fixes together. |
| 7 | Flexibility and Efficiency | n/a | Read surface. |
| 8 | Aesthetic and Minimalist Design | 2 | Three levels of boxes: the "Your answers" card contains a bordered box per answer, which contains a bordered box per correction. Plus 3 metric cards, a freeze card and a confidence strip. |
| 9 | Error Recovery | 3 | Report failures show a retry. |
| 10 | Help and Documentation | 3 | Redo marker explains what to do first. |
| **Total** | | **26/36** | Good |

## Design Specificity Verdict
Specific: progress line first, freeze, confidence before and after, the answer to redo. This is the report that proves the product's claim.

## Deterministic scan
The detector reports nested cards on the live landing's mock only; the report's nesting was found by reading the component (Card > li border box > correction border box) and in the screenshots. Scripted audit at 375px: "Practice again" 130x42 and "Back to practice" 146x42 (44px needed); status chips 12px.

## Overall Impression
The right content in the right order, wrapped in too many boxes.

## What's Working
1. Progress before mistakes.
2. The freeze and the confidence are shown as numbers the student can compare.
3. The answer to redo is called out.

## Priority Issues
- **P1 Nested cards.** Fix: keep one container for "Your answers" and separate answers with dividers; corrections are plain text with a strike and a green fix, no border.
- **P1 The coach's note is only in French** with no visible way to read it in English. Fix: an "Explain in: English | French" toggle on the report that regenerates the note.
- **P1 Touch targets 42px** on the two main buttons and chips at 12px. Fix: 44px, 14px.
- **P2 Confidence ask sits between the metrics and the freeze**, interrupting the numbers. Fix: group the numbers first, then the ask.

## Persona red flags
- A student who reads French better than English may want the English note to practice reading; the other way round for a beginner.
- A student on a small phone scrolls past three levels of borders to find the first correction.

## Questions skipped
Questions skipped: the scope is fixed by the project brief (8 listed fixes); issues map to items (5), (7), (8).
