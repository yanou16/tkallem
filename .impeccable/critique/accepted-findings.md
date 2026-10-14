# Accepted detector findings (pass 2, production, 15 October 2026)

`npx impeccable detect` on every production page that a guest can reach (/welcome, /plan, /practice, /sign-in, /sign-up, /forgot-password, /groups, /ai-chat): everything is at 0 findings except the landing page, whose remaining findings are listed here with the reason they stay. Pages behind sign-in (Home, Progress, Profile) cannot be scanned by URL as a guest; they were checked by the scripted audit and by the critique agents.

## /welcome: `nested-cards` (advisory), 8 occurrences
- Where: the product tour, inside the framed browser window (`features/landing/TourParts.tsx` Browser, `PlatformPages.tsx`): stat tiles, scenario cards and list boxes drawn inside the window.
- Why accepted: the window is a drawing of the real application, and the real application has cards. The landing page itself has no card inside a card. Flattening the drawing would make the preview less faithful to what the student gets.
- Revisit if: the tour is redesigned as screenshots.

## Detector limits worth knowing (so a "0" is read correctly)
- The source scan (`impeccable detect src/`) reads class patterns in `.tsx` (it found `border-l-4`) but does not evaluate inline styles or the token rules of `docs/DESIGN.md`. Those are guarded by `apps/web/src/design-tokens.test.ts` instead.
- Live-URL scans of /practice and /ai-chat timed out (30 s navigation) inside two sub-agents although the pages answer in 0.3 s; the same scans succeeded when run directly. A timeout is not a clean result.
- Contrast on the tour is measured at the moment the page is scanned. Since the tour no longer dims the parts that are not lit (it only outlines the lit one), every text keeps its full contrast.
