---
target: AI Chat (production)
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 3
target_identity: "file:/Users/yanou/Projects/tkallem/apps/web/src/app/(app)/ai-chat/page.tsx"
target_fingerprint: "sha256:0fed4787fecfc36fe23e92030d9630f4abe1c766b853a1f64815dd5934f5bdc0"
target_path: /Users/yanou/Projects/tkallem/apps/web/src/app/(app)/ai-chat/page.tsx
timestamp: 2026-10-14T17-51-34Z
slug: apps-web-src-app-app-ai-chat-page-tsx
---
Method: dual-agent (A: a5c20eac74c1cb2db · B: adedffe1629cc3047), two isolated sub-agents, A finished without seeing B.

# Critique pass 2: AI Chat (production)

Mode: Operate. Previous pass (single-context, pass 1): 27/40. Scores differ by 1-2 points between passes because a different reviewer scored each one; read the trend as noise-level unless the issues list changed.

## Design Health Score (Assessment A)
| # | Heuristic | Score |
|---|-----------|-------|
| 1 | Visibility of System Status | 3 |
| 2 | Match System / Real World | 3 |
| 3 | User Control and Freedom | 2 |
| 4 | Consistency and Standards | 3 |
| 5 | Error Prevention | 2 |
| 6 | Recognition Rather Than Recall | 2 |
| 7 | Flexibility and Efficiency | 3 |
| 8 | Aesthetic and Minimalist Design | 2 |
| 9 | Error Recovery | 3 |
| 10 | Help and Documentation | 3 |
| **Total** | | **26/40** |

## Assessment A summary
Specificity: disciplined but category-generic (2/4): no question counter, freeze absent, stakes cues absent.
P0@320/P1@375 vertical budget: 5 rows of chrome (~270px) before the first question; conversation viewport 318px @375 start, 180 with Help, 146px @320 start, ~33px @320 with Help open (panel hides the question). Text field truncated "Type he" at 320. Fix: merge/hide settings rows during a session (fold "Explain in" and the count onto one line), keep the question visible when Help opens. (page.tsx L291-292, L300-326, L376-391, HelpMeStart)
P1 auto-scroll lands past the content that matters: scrollIntoView on `bottom` (L182) with ConfidenceAsk after messages (L395): first question cropped, correction above the fold after an answer. Scroll to the start of the newest exchange.
P1 confidence scale (6 options) before the first question at the freeze moment: compact single line / not blocking.
P2 Voice|Text toggle mislabels itself (only decides whether the coach speaks; mic and field visible in both): relabel ("Coach voice") or show/hide mic.
P2 English-only microcopy and praise in English next to a French why; "Explain in" costs a full row on phones.
Minor: timestamps and permanent 0/500 noise; Real interview pill looks like the active toggle; interview mode keeps Explain toggle; desktop sidebar off-token (white cards, shadow, green Active dot, chevron to nowhere); coach bubble rounded-3xl; recording cannot be cancelled and costs an answer; scenario switch restarts without confirmation.


## Assessment B summary (detector and scripted audit)
Live detect: FAILED in the sub-agent (navigation timeout 30s, twice; curl 200). My own earlier parent run on the same URL returned 0 findings. Source detect: 0.
Audit: no overflow at 375/320/1280; 0 controls <44px on every chat key; tiny text: tab labels 12px, "2 fixes"/"1 fix" 13px, report pills 13px; no 11px text on chat screens.
Note: "2 fixes" at 375/320 vs "1 fix" at 1280 = different runs (different answers), not a bug.


## Questions skipped
Questions skipped: the scope is fixed by the project brief (fixes only, feature freeze).
