---
target: "Profile (localhost, same code: behind sign-in in production)"
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:/Users/yanou/Projects/tkallem/apps/web/src/app/(app)/profile/page.tsx"
target_fingerprint: "sha256:2fb07d58bd90f233e3415e4a789e2649a598e249443e3e59bae4b3a7035a394e"
target_path: /Users/yanou/Projects/tkallem/apps/web/src/app/(app)/profile/page.tsx
timestamp: 2026-10-14T17-51-34Z
slug: apps-web-src-app-app-profile-page-tsx
---
Method: dual-agent (A: ad8463471809c2a53 · B: abef3a98b18ccbb8a), two isolated sub-agents, A finished without seeing B.

# Critique pass 2: Profile (localhost, same code: behind sign-in in production)

Mode: Operate. No previous score: first critique of this target.

## Design Health Score (Assessment A)
| # | Heuristic | Score |
|---|-----------|-------|
| 1 | Visibility of System Status | 3 |
| 2 | Match System / Real World | 3 |
| 3 | User Control and Freedom | 3 |
| 4 | Consistency and Standards | 2 |
| 5 | Error Prevention | 3 |
| 6 | Recognition Rather Than Recall | 3 |
| 7 | Flexibility and Efficiency | 2 |
| 8 | Aesthetic and Minimalist Design | 2 |
| 9 | Error Recovery | 3 |
| 10 | Help and Documentation | 2 |
| **Total** | | **26/40** |

## Assessment A summary
Specificity: generic SaaS settings template.
P1 colour: violet (lilac tone) on Explanation language / Focus areas; pastel tints assigned by position (TONES in components/ui.tsx), colliding with scenario meaning; brand-yellow-like butter-deep disc on achievements. Fix: neutral surface for all setup tiles and badges, ink icon chip, remove lilac.
P1 desktop 1280: 3-col grid inside ~570px main column -> text one word per line; pencils clipped/overlapping (-mr-2). Fix: md:grid-cols-2 / xl:grid-cols-2, move Account settings below.
P2 shadows on Card (shadow-soft) - DESIGN.md: shadows only modals/dropdowns.
P2 contrast: locked badges opacity-60 (<=2.5:1), italic muted hints on pastels. Fix: drop opacity, slate text, no italics.
P3 duplicated identity: H1 "{firstName}" text-5xl + H2 fullName; H1 48px on mobile (DESIGN: 28). One title only.
Minor: same chart icon for level and daily goal; text-red-600 should be bad token #B42318; 132px avatar big on mobile; guest sees Personal info/Profile photo/Email & password rows (dead end?); Recent activity duplicate titles.
Persona: stressed guest sees nothing about practice; jury sees locked badges. Guest account rows call clerk.openUserProfile() with no user (verify).


## Assessment B summary (detector and scripted audit)
Source detect 0 (coverage gap: class patterns only; no token or inline-style rules). Audit: no overflow 375/320/1280; 0 small targets; tinyText 5 mobile (12px nav labels only), 0 desktop.
Off-token: #111111 (globals.css:90), #6B6B76 (muted), VIOLET lilac #E8E2FB and #D0C6F5 (tailwind.config.ts:21; SetupCard tone 4 and Badge), butter #FFF0BF/#FFE08A, mint/peach/rose, translucent bg-black/.04-.06, bg-white/.6-.7, #1DB87E (ui.tsx:164,175), #ECECF0 line, text-red-600 (page.tsx:218, ChooseLevel.tsx:50), rounded-card 22px, shadow-soft; weights 700/800 AppShell.tsx:33,35.
Contrast: #6B6B76 on #E8E2FB 4.19 FAIL, on #D0C6F5 3.28 FAIL, on #FFF0BF 4.63 pass thin; white on #1DB87E 2.56 FAIL.
Ranked: violet pastels; Tailwind config extends palette beyond DESIGN; body #111/#FDFDFB; muted on lilac contrast; 700/800 wordmark; 12px nav; text-red-600/#1DB87E/#ECECF0.


## Questions skipped
Questions skipped: the scope is fixed by the project brief (fixes only, feature freeze).
