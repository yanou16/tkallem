# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Algerian students who understand English but freeze when they have to speak it in a decisive moment: a US visa interview, a Campus France interview, a remote job interview, IELTS Speaking, or an everyday situation (taxi, shop, cafe, airport). They are stressed and mostly on a phone. They read French better than English, and explanations in French reassure them. Many try the product alone and without an account.

## Product Purpose
A private place to rehearse the real interview out loud first. An AI coach asks the real questions, listens, says what was good and corrects the one thing that matters most, and explains it in French. Success: the student starts speaking sooner (the "freeze" time goes down), makes fewer mistakes per 100 words, and feels more confident (self-rated 1 to 5, before and after).

## Positioning
Not a generic English course or chat bot: it rehearses the exact high-stakes interviews Algerian students face, shows the freeze as a number, and never lets the model decide alone what the student sees (the code validates every correction, compliment, hint and progress line).

## Operating Context
Used for 5 to 10 minute sessions, by voice or text, on a phone browser or an installed PWA, often in a noisy or shared place. Judges of the Thirduni competition open the live link alone (internal deadline 29 October, hard deadline 31 October 23:59 Algiers, judging 1 to 7 November): the guest path (no account, 40 free answers) must work and explain itself.

## Capabilities and Constraints
- Ten situations (five interviews and exams, four everyday scenes, free talk); Practice mode (corrections, Help me start, Say it again) and Real interview mode (nothing shown until the report).
- Guests get 40 free answers; signing in adds 60, then 15 a day. "Answers" is the word for the free allowance.
- Groups are read-only for guests (log in to unlock).
- docs/JURY_BRIEF.md applies: FEATURE FREEZE (only fixes and the four listed improvements), "the model talks, the code decides", small PRs, tests and evals before every merge, docs/DESIGN.md is the visual source of truth, no secrets in the repo.
- Language: English interface, US spelling, explanations in French or simple English.

## Brand Commitments
Name Tkallem, yellow logo mark (#FFD02F), Figtree, black pill buttons. Yellow is only for the logo, the microphone ring and the PWA theme. The authority for every visual decision is docs/DESIGN.md, which `/impeccable document` must never overwrite.

## Evidence on Hand
Live app https://tkallem.vercel.app; evaluation results (29/29 mistakes found, 0 false alarm, 9/9 prompt injections handled); docs/IMPACT.md for the self-rated confidence figures; docs/TESTING.md. No real testimonials yet: do not invent any.

## Product Principles
1. Reassure before correcting: one true compliment, then one fix.
2. Every screen answers one question and has one primary action.
3. The student never has to understand the technology: no jargon, no dead ends, a clear next step.
4. Honest numbers only: progress, freeze and confidence come from stored data, never from the model.
5. Works alone on a phone, without an account.

## Accessibility & Inclusion
Touch targets of at least 44 px, body text of at least 14 px, AA contrast, meaning never carried by color alone, reduced motion respected. Low-end Android phones and slow connections are the baseline.
