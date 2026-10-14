---
target: Practice (production)
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:/Users/yanou/Projects/tkallem/apps/web/src/app/(app)/practice/page.tsx"
target_fingerprint: "sha256:860c17dca99b2e148e159496b047a216f4c111d5dac0093befa5d5135504398f"
target_path: /Users/yanou/Projects/tkallem/apps/web/src/app/(app)/practice/page.tsx
timestamp: 2026-10-14T17-51-34Z
slug: apps-web-src-app-app-practice-page-tsx
---
Method: dual-agent (A: a4962073e5b03802b · B: af78a338ba5898b3c), two isolated sub-agents, A finished without seeing B.

# Critique pass 2: Practice (production)

Mode: Operate. No previous score: first critique of this target.

## Design Health Score (Assessment A)
| # | Heuristic | Score |
|---|-----------|-------|
| 1 | Visibility of System Status | 3 |
| 2 | Match System / Real World | 3 |
| 3 | User Control and Freedom | 3 |
| 4 | Consistency and Standards | 3 |
| 5 | Error Prevention | 3 |
| 6 | Recognition Rather Than Recall | 3 |
| 7 | Flexibility and Efficiency | 2 |
| 8 | Aesthetic and Minimalist Design | 2 |
| 9 | Error Recovery | 3 |
| 10 | Help and Documentation | 2 |
| **Total** | | **27/40** |

## Assessment A summary
Specificity: partly (tints, pills) but generic catalog template; subtitle filler; interviews buried at positions 6-10 behind grey everyday cards.
P1 ten equal black pills and interview/exam scenarios buried: sort interviews/exams first for a guest without plan, or two group headings (Interviews and exams / Everyday situations).
P1 "Real interview: no corrections until the end" link x10, wraps to 2 lines at 320; "no corrections" reads as threat. Shorten to "Real interview"; explain once above the grid; keep 44px.
P2 generic header copy; "All practice scenarios" redundant; "scenarios" vs "situations".
P2 level only as small grey eyebrow; DESIGN.md says show the level ("Coach at B1").
P3 Recent sessions and "Your plan" low on mobile; aria-label with scenario title on each card link.
Minor: h1 36px on mobile (spec 28); card title/padding drift; unequal card heights on desktop; 10 primary pills vs one per screen; mobile credits pill has no unit word.


## Assessment B summary (detector and scripted audit)
Live detect failed in the sub-agent (timeouts; parent baseline run earlier returned 0 findings on /practice). Source detect 0.
Audit: no overflow at 375/320/1280; 0 targets <44 on mobile and desktop (practice); tinyText 5 mobile (13px level pills A2/B1/B2 + 12px nav labels), 3 desktop.
Desktop welcome top nav 5 links 107x40 (<44) on /welcome only.


## Questions skipped
Questions skipped: the scope is fixed by the project brief (fixes only, feature freeze).
