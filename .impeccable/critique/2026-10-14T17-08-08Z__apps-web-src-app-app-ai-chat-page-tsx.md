---
target: AI Chat
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 6
target_identity: "file:/Users/yanou/Projects/tkallem/apps/web/src/app/(app)/ai-chat/page.tsx"
target_fingerprint: "sha256:97379c38f078667289559d89b688f9bd565dd9b8ce1923e92a187ab0104f2732"
target_path: /Users/yanou/Projects/tkallem/apps/web/src/app/(app)/ai-chat/page.tsx
timestamp: 2026-10-14T17-08-08Z
slug: apps-web-src-app-app-ai-chat-page-tsx
---
⚠️ DEGRADED: single-context (the session policy does not allow spawning the two isolated sub-agents; Assessment A was written from screenshots (desktop 1280 and phone 375) and source, then the detector and the scripted audit were merged)

# Critique: ai-chat (/ai-chat)

Mode: Operate. All 10 heuristics scored. Score is out of 40.

## Design Health Score
| # | Heuristic | Score | Key issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Listening / Thinking / Speaking labels, "N answers" counter. But "Speaking…" shows after a typed answer when the coach voice plays, which looks like a stuck state. |
| 2 | Match System / Real World | 3 | Clear verbs ("Say it again", "Help me start"). "credits" in the pill vs "answers" in the counter. |
| 3 | User Control and Freedom | 3 | Stop, End session, Help closes. A sent answer cannot be edited. |
| 4 | Consistency and Standards | 2 | The header mixes a scenario menu, a Level chip, a "Practice" chip that looks like a button but is not, and a Voice/Text toggle. |
| 5 | Error Prevention | 3 | Silent recordings are refused before sending; 500-character counter. |
| 6 | Recognition Rather Than Recall | 2 | Nothing on screen says which language the explanations are in or how to change it. |
| 7 | Flexibility and Efficiency | 3 | Type or speak, Say it again, Help me start. |
| 8 | Aesthetic and Minimalist Design | 2 | On a phone, four stacked rows (app header, scenario + mode chip, Voice/Text, counter strip) come before the first question; on desktop the side panel repeats the correction already shown under the answer. |
| 9 | Error Recovery | 3 | Retry buttons and clear messages (no credits, mic denied). |
| 10 | Help and Documentation | 3 | Help me start gives the first words or a French/Darija translation. |
| **Total** | | **27/40** | Good |

## Design Specificity Verdict
Strongly specific: compliment, one fix, "Say it:" line, Say it again. The header is the part that looks like a generic AI-chat toolbar.

## Deterministic scan
Source scan: nothing in the chat page. Scripted audit at 375px: "End session" 109x38, "Listen to this line" 61x20, "Stop" 70x26 are below 44px; 12px timestamps, "Tap to speak" 11px, "0 / 500" 12px, correction explanations 12px.

## Overall Impression
The conversation itself is the best screen of the product. The chrome around it is heavier than the conversation.

## What's Working
1. The correction card: compliment first, one fix struck in grey and shown in green, French explanation, "Say it".
2. The answer field and the mic stay on screen on a phone (fixed layout).
3. Real interview mode stays neutral and shows no feedback.

## Priority Issues
- **P1 Header has too many controls.** Level chip (duplicate of Profile), a mode chip that is not a toggle, a 3D coach toggle, and Voice/Text. Fix: one mode toggle (Voice / Text), the scenario menu, and a status chip only when the mode is Real interview.
- **P1 Touch targets below 44px**: End session 38px, Listen 20px, Stop 26px. Fix: 44px minimum with padding, same visual weight.
- **P1 Small text**: timestamps and counters at 11 to 12px. Fix: 14px minimum for readable text.
- **P1 No visible language control.** Corrections arrive in French (profile default) with no way to switch. Fix: a visible "Explain in: English | French" toggle on the chat.
- **P2 "Speaking…" after a typed answer.** Fix: show it only in voice mode or when the coach voice is actually playing.
- **P2 Credits vs answers** wording.

## Persona red flags
- Student with a small phone: header takes about 30% of the height before the first question.
- Student who reads French better than English: cannot tell the language is switchable.

## Questions skipped
Questions skipped: the scope is fixed by the project brief (8 listed fixes); issues map to items (2), (6), (7), (8).
