# Pitch assets: real screens of Tkallem

Six screenshots of the live app, no mock and no stubbed API. A guest session, no account, Text mode (Playwright has no real microphone).

| File | What it shows |
|---|---|
| `01-welcome.png` | Landing page, top |
| `02-visa-first-question.png` | Visa interview, first coach question: "What is the purpose of your trip?" |
| `03-correction.png` | Reassuring correction: praise, then one priority fix (`for studying` to `to study`) |
| `04-say-it-again.png` | "Say it again": the button while recording (fake microphone, nothing was sent) |
| `05-freeze-meter.png` | Report: "Time before you write", measured on 3 answers |
| `06-report.png` | Session report, top |

**How:** Playwright, Chromium (Chrome for Testing), `https://tkallem.vercel.app`, 2026-10-16, viewport 390x844, device scale factor 2, mobile with touch, light theme, viewport screenshots only (no browser chrome, no address bar, so no session id is visible).
`capture.mjs` in this folder reproduces 03 to 06: `CHROME_PATH=<chrome> A1="<answer>" node capture.mjs`.
The answer typed for 03: "I will go to the US for studying my master. I have admission in Boston University." Two more answers followed so the report has content.
`apps/web/public/landing/how-*.png` are crops of 02, 03 and 04 (made with `sips -c`).

**Honest notes**
- This is the second of two real runs. The first used "I go to the United States for study my master in computer science." and the coach corrected `go` to `went` (past tense) with a French explanation about a past event. That is wrong for a trip that has not happened yet, so we did not use that run. See the pull request for the details.
- The guest balance shows 39, then 37 after the report: one credit per answer, as designed.
- The time in the first bubble and the "Time before you write" value are real measurements from that run.
