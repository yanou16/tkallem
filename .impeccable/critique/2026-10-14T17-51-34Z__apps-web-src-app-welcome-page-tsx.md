---
target: Landing page (production)
total_score: 22
max_score: 32
na_heuristics: 7,10
p0_count: 0
p1_count: 3
target_identity: "file:/Users/yanou/Projects/tkallem/apps/web/src/app/welcome/page.tsx"
target_fingerprint: "sha256:8780e27d3bd65c7f16ef9b0ffe6771609add082f5aa5e17bfc6d9836e8d0c5b4"
target_path: /Users/yanou/Projects/tkallem/apps/web/src/app/welcome/page.tsx
timestamp: 2026-10-14T17-51-34Z
slug: apps-web-src-app-welcome-page-tsx
---
Method: dual-agent (A: ab2ea750f7d2d1ffe · B: ab30e1a9ca87a9f0f), two isolated sub-agents, A finished without seeing B.

# Critique pass 2: Landing page (production)

Mode: Persuade. Previous pass (single-context, pass 1): 20/32. Scores differ by 1-2 points between passes because a different reviewer scored each one; read the trend as noise-level unless the issues list changed.

## Design Health Score (Assessment A)
| # | Heuristic | Score |
|---|-----------|-------|
| 1 | Visibility of System Status | 3 |
| 2 | Match System / Real World | 3 |
| 3 | User Control and Freedom | 2 |
| 4 | Consistency and Standards | 3 |
| 5 | Error Prevention | 3 |
| 6 | Recognition Rather Than Recall | 3 |
| 7 | Flexibility and Efficiency | n/a |
| 8 | Aesthetic and Minimalist Design | 2 |
| 9 | Error Recovery | 3 |
| 10 | Help and Documentation | n/a |
| **Total** | | **22/32** |

## Assessment A summary
Specificity: content specific; visual recipe interchangeable (accepted by DESIGN.md).
P1 hero proof below fold and chips hidden on mobile (HeroExample.tsx l27, l30 hidden sm:inline-flex): show chips as a static row on mobile.
P1 primary button leads to 5-question quiz; "Or try a visa interview right away" is the weakest element: promote to a visible secondary button; say what primary does.
P1 tour legibility: opacity-30 on non-lit regions (TourParts.tsx l14) -> ~0.6 or outline only; on mobile 9 caption chips below preview -> show only the active caption under the preview; desktop connector lines cross content; right captions touch the page edge.
P2 headline hierarchy inversion: promise sentence in steel, lead-in in ink; widow "it." at 375.
P2 DESIGN drift: wordmark font-bold/logo font-extrabold (page.tsx l33-34); shadow-pop on non-modals in HeroExample (l12,l27,l30); "Ten real situations" vs 9 cards (HIDDEN_HERE).
P3 page length ~6250px mobile; footer text-muted 14px -> slate.
Minor: tabs no arrow keys; 4 primary "Build my speaking plan" buttons; radii 36/40 vs 28 max; sidebar pill row clipped at 375 ("Progress" cut).


## Assessment B summary (detector and scripted audit)
Live detect: 31 (3 warnings, 28 advisories): gray-on-color 1 (FALSE POSITIVE: #555a6a on #fff1d6 = 6.15:1); low-contrast 20 (all caused by tour spotlight opacity-30 on non-lit regions, TourParts.tsx:14, so numbers like KPI values, "Time before you speak" and the Practice/Real interview links sit at 1.5-1.9:1 while dimmed); nested-cards 9 (mock UI fidelity; 1 warning in HeroExample.tsx:18); tiny-text 1 (11px mock). Source detect: 1 side-tab (PlatformPages.tsx:115 border-l-4 in the mock).
Audit: no overflow 320/375/1280; mobile 0 small targets; tinyText 30 (mobile) 36 (desktop), mostly mock; desktop 5 mock sidebar buttons 40px (min-h-10).
R1 spotlight dims informative text for most of the autoplay time (30%): keep text at full contrast, dim surface/outline only, or dim far less. R2 mock link text 11px (Practice →, Real interview →); "Example: a US visa interview" 12px in the hero. R3 mock controls 32-36px on desktop. R4 side-stripe border-l-4. R5 flatten hero nested card (HeroExample.tsx:18). Copy: mock "33 free answers" vs page "40".


## Questions skipped
Questions skipped: the scope is fixed by the project brief (fixes only, feature freeze).
