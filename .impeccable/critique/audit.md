# Audit: accessibility, responsive, touch targets, small text

Method: scripted pass with Chromium (phone viewport 375x812, device scale 2) on the local app with a real 6-answer session, plus the detector. Desktop (1280) was checked with screenshots and the detector only; 320px was not scripted. Nothing here is a screen-reader test.

## Scores at a glance
- Responsive: no horizontal overflow on any of the 24 phone captures.
- Names and structure: no control without an accessible name, no image without alt, one h1 per page, `<html lang="en">`.
- Touch targets (44px): 6 of 17 screens have controls under 44px. Worst: Practice cards (10 buttons at 105x36), Profile edit pencils (27x27, x7), Home "View all scenarios" (129x20), chat "Listen" (61x20), "Stop" (70x26), "End session" (109x38), report buttons (42px high).
- Small text (under 14px): every screen has some. 11px: bottom navigation labels and "Tap to speak". 12px: timestamps, chips (A2/B1, Clean, 2 fixes), "0 / 500", correction explanations, badges. The landing demo mock adds 31 more, as it mirrors real UI at reduced size.
- Contrast: one real failure: `#6b6f7e` on `#fff1d6` = 4.48:1 (hero example). The tour's dimmed regions (opacity .3) are flagged by the detector but are a transient lit/unlit state.

## Per screen (phone)
| Screen | Overflow | Targets < 44px | Text < 14px | Examples |
|---|---|---|---|---|
| welcome-top | no | 0 | 31 | - |
| sign-in | no | 2 | 7 | Forgot password? (106x36), Create an account (108x36) |
| sign-up | no | 1 | 10 | Sign in (40x36) |
| forgot | no | 1 | 3 | Use Continue with Google (147x35) |
| plan-1 | no | 0 | 6 | - |
| plan-7-result | no | 0 | 6 | - |
| practice | no | 10 | 9 | Practice (105x36), Practice (105x36), Practice (105x36) |
| groups-guest | no | 0 | 6 | - |
| chat-start | no | 2 | 10 | Listen to this line (61x20), Skip (43x44) |
| chat-answer-1 | no | 4 | 14 | End session (109x38), Listen to this line (61x20), Listen to this line (61x20) |
| chat-help | no | 4 | 13 | End session (109x38), Listen to this line (61x20), Listen to this line (61x20) |
| chat-report | no | 2 | 11 | Practice again (130x42), Back to practice (146x42) |
| interview-start | no | 2 | 10 | Listen to this line (61x20), Skip (43x44) |
| interview-answer | no | 3 | 11 | End session (109x38), Listen to this line (61x20), Listen to this line (61x20) |
| home | no | 7 | 10 | View all scenarios (129x20), Practice (105x36), Practice (105x36) |
| progress | no | 0 | 8 | - |
| profile | no | 9 | 8 | Edit name (27x27), Edit English level (27x27), Edit Explanation language (27x27) |

## Findings by priority
- **P1** Touch targets under 44px in the chat (End session, Listen, Stop), the report (Practice again, Back to practice), Practice cards, Home links, Profile pencils.
- **P1** Body text under 14px: timestamps, counters, chip labels, correction explanations, nav labels.
- **P2** One contrast failure on the amber background in the hero example.
- **P2** The mic button has no visible text label while recording ("Tap to speak" is 11px).
- **P3** Bottom navigation has six items on a phone (five after the Practice/AI Chat merge), labels at 11px.

## Not verified
VoiceOver/TalkBack, 200% zoom, keyboard-only walk-through of the chat, iPhone Safari, 320px width.
