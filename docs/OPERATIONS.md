# Running Tkallem during judging week (1 to 7 November)

## The spending switch

Every answer uses one free answer (called a credit in the code, `docs/CREDITS.md`). `DAILY_SPEND_CAP` (API environment) is the number of answers that
everybody together may spend per day (UTC). When it is reached, students see "Today's free practice is used up, come
back tomorrow" until midnight UTC. Nothing else stops.

What one answer costs us (measured October 2026):

| Answer | Cost |
|---|---|
| Typed | about 0.0003 $ (language model) |
| Spoken, voice by Groq Orpheus | about 0.0034 $ (model + transcription + voice) |
| Spoken, voice by DeepInfra Kokoro | about 0.0009 $ |

So the cap bounds the daily bill: 5000 answers (default) is at most about 17 $ a day if every answer is spoken with
Orpheus, about 1.5 $ if they are typed.

## Alerts

- At `BUDGET_ALERT_RATIO` (default 80 %) of the cap, and again when the cap is reached, the API logs a warning once a
  day and posts it to `ALERT_WEBHOOK_URL` if set (a Slack or Discord incoming webhook).
- Set the webhook to a channel the three of us read before 1 November.

## Plan for 1 to 7 November

1. Before 1 November: top up OpenRouter and DeepInfra (Groq Orpheus is limited to about 100 voices a day on our
   account: Kokoro takes over after that, then the browser's own voice).
2. Keep `DAILY_SPEND_CAP=5000`: judges use a few hundred answers at most.
3. If the 80 % alert comes and the traffic is real (judges, students who heard about it), raise the cap in the Render
   environment (for example to 10000) and redeploy; lower it back on 8 November.
4. Every morning: open the live link in a private window and run one guest visa interview (voice and text).
