---
target: "Progress (localhost, same code: behind sign-in in production)"
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:/Users/yanou/Projects/tkallem/apps/web/src/app/(app)/progress/page.tsx"
target_fingerprint: "sha256:edb299432fc6ad4f4454b5acf85ef287e703df8a0819b358d9dd16250dbe701c"
target_path: /Users/yanou/Projects/tkallem/apps/web/src/app/(app)/progress/page.tsx
timestamp: 2026-10-14T17-51-34Z
slug: apps-web-src-app-app-progress-page-tsx
---
Method: dual-agent (A: a22923f4f3e5cdf0d · B: a67783855edfdb56e), two isolated sub-agents, A finished without seeing B.

# Critique pass 2: Progress (localhost, same code: behind sign-in in production)

Mode: Operate. No previous score: first critique of this target.

## Design Health Score (Assessment A)
| # | Heuristic | Score |
|---|-----------|-------|
| 1 | Visibility of System Status | 3 |
| 2 | Match System / Real World | 2 |
| 3 | User Control and Freedom | 3 |
| 4 | Consistency and Standards | 3 |
| 5 | Error Prevention | 3 |
| 6 | Recognition Rather Than Recall | 3 |
| 7 | Flexibility and Efficiency | 2 |
| 8 | Aesthetic and Minimalist Design | 2 |
| 9 | Error Recovery | 3 |
| 10 | Help and Documentation | 2 |
| **Total** | | **26/40** |

## Assessment A summary
Specificity: generic dashboard; DESIGN.md stat card (ink, big number, badge) unused; freeze/confidence absent.
P1 no hierarchy: 4 identical tiles, north-star mistakes weighted like speaking time; change line plain 14px, no badge. Fix: first tile prominent (ink stat card or full width), change in a badge with a word. On mobile, top mistakes before voice-only tiles.
P1 no-data wall: "No comparison yet" x4, "—" bold 36px; show once / hide until baseline; one EmptyState with a "Start a practice session" button when all null; dash small, stone.
P2 dead end + "No mistakes yet" ambiguous: change to "No corrections yet", add action link to Practice.
P2 jargon/direction cues: add lower/higher is better; "Voice sessions only" -> "Do a voice session to see this"; define "first sessions".
P3 drift: Card shadow-soft; stat text-4xl vs 64/500 token; bg-black/5 chip not a token; "—" and "2×" lack aria labels; labels not headings.
Minor: mobile credit pill "33" without unit; subtitle text-lg wraps 3 lines; skeleton single h-56; `!p ? null` blank page; TONES has lilac.


## Assessment B summary (detector and scripted audit)
Source detect: 0 (exit 0). CAVEAT: B tested a fixture with inline-style violations in .tsx -> [] while the same in .html -> 6 findings. But the earlier src/ scan did flag a Tailwind class (border-l-4 side-tab) in a .tsx, so tsx scanning covers class patterns but not inline styles or token adherence. A zero on source is not a clean bill; rendered-page evidence is what counts.
Audit: no overflow 375/320/1280; 0 small targets; tinyText 7 mobile (13px chips "2 x"/"1 x" + 12px nav), 2 desktop; unnamed 0; no-alt 0; h1 1.
Off-token (stale 16:11 snapshot): text #6B6B76 (text-muted tailwind.config.ts:14) x21, #111111 body x14 (globals.css:90), bg-black/5 chips, border-line #ececf0, success #1DB87E, body bg #fdfdfb; weights 700/800 (AppShell.tsx:33,35 logo+wordmark); 11px x6 unresolved; 12px nav labels; 15px sidebar; stat values 36px/600 vs 64/500; Card radius 22px + shadow-soft vs 28/no shadow.
Ranked: 1) mobile h1 36px vs 28 + stat 36/600 vs 64/500; 2) generic cards w/ shadow and 22px radius; 3) off-token theme tokens (muted, line, success, body #111, bg-black/5); 4) AppShell 700/800 + 12px nav + 15px sidebar; 5) unresolved 11px.


## Questions skipped
Questions skipped: the scope is fixed by the project brief (fixes only, feature freeze).
