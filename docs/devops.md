# DevOps and delivery

How a change goes from a laptop to the live app, what stops a bad one, how we watch production, and how we release.
Other parts: [System design](system-design.md) · [AI coach](ai.md) · [← back to the README](../README.md)

## Contents

1. [The loop](#the-loop)
2. [Where things run](#where-things-run)
3. [From a change to production](#from-a-change-to-production)
4. [The checks (CI)](#the-checks-ci)
5. [The AI gate](#the-ai-gate)
6. [Build and deploy](#build-and-deploy)
7. [Configuration and secrets](#configuration-and-secrets)
8. [Monitoring and cost control](#monitoring-and-cost-control)
9. [Releases and tags](#releases-and-tags)
10. [Rollback](#rollback)
11. [Judging-week routine](#judging-week-routine)
12. [What we do not have yet](#what-we-do-not-have-yet)

## The loop

![The DevOps loop of Tkallem: plan, code, build, test, release, deploy, operate, monitor, with the tools used at each step](images/devops-loop.svg)

Every change goes round the whole loop. Nothing reaches production without passing the tests, and what runs in production
is watched, which feeds the next plan.

## Where things run

| Part | Where | Notes |
|---|---|---|
| Web app (`apps/web`) | Vercel, Hobby plan | Deploys from GitHub on every push; a preview URL for every pull request |
| API (`apps/api`) | Azure App Service, Linux container, plan B1, Frankfurt | **Always On**, HTTPS only, health check on `/health` |
| API image | GitHub Container Registry (`ghcr.io/yanou16/tkallem-api`) | Tagged with the commit and `latest` |
| Database | Neon PostgreSQL, Frankfurt (next to the API) | Free plan; migrations run at container start |
| Sign-in | Clerk (development instance) | Guests do not need it |
| Models and voice | OpenRouter, Azure Speech, Groq, DeepInfra | Pay as you go, capped by `DAILY_SPEND_CAP` |

There is **one production environment** and no staging: previews of the web app stand in for it, and the API is tested
against a real Postgres in CI instead.

## From a change to production

1. **Plan.** One small task, one pull request, one topic.
2. **Code.** On a branch. A local **pre-push hook** (`.githooks/pre-push`, enable with `git config core.hooksPath .githooks`)
   runs the agent tests, the API tests without a database, and the web typecheck and tests, and refuses a direct push to
   `main`.
3. **Pull request.** CI runs everything below. Vercel builds a preview of the web app.
4. **Merge.** Squash merge, **only when `CI ok` is green** (branch protection requires it, and requires the branch to be up
   to date with `main`).
5. **Deploy.** Vercel deploys the web app. If the API or the agent changed, GitHub Actions builds the image, pushes it, and
   deploys it to Azure.
6. **Check.** A smoke test fails the deploy unless the new version is really live (see [Build and deploy](#build-and-deploy)).

## The checks (CI)

`.github/workflows/ci.yml`. The single job **CI ok** is what branch protection looks at; it passes only when all of these
pass.

| Job | What it runs | What it catches |
|---|---|---|
| **Agent tests** | `pytest` in `packages/agent`, no network | The coach's logic and guardrails |
| **API tests (with Postgres)** | A real Postgres 16 service, `alembic upgrade head`, then `pytest` | Routes, SQL, concurrency (two answers at once), migrations that do not apply |
| **Front typecheck, tests and build** | `npm ci`, `npm run typecheck`, `npm test`, `npm run build` on Node 22 | Type errors, broken screens, a build that would fail on Vercel |
| **API image builds** | The same Docker build as production, without pushing | A broken Dockerfile or dependency |
| **AI evals** | The [AI gate](#the-ai-gate), only when `packages/agent` changed | A prompt or model change that makes the coach worse |

Pull requests run everything; pushes to `main` run it again. A new push to the same branch cancels the older run.

## The AI gate

A prompt change is a code change, so it is tested. When a pull request touches `packages/agent/tkallem_agent` or
`packages/agent/evals`, CI runs `evals/gate.py` against a real model and **fails the merge** unless:

- every seeded mistake of the correction set is detected (29 of 29),
- there is no false alarm on correct sentences,
- the 9 prompt-injection attacks are all handled,
- there is no invalid output.

The gate calls a paid model, so it only runs when the agent changed. If it must run and the `OPENROUTER_API_KEY` secret is
missing, the job fails on purpose instead of skipping silently.

## Build and deploy

**API.** `.github/workflows/api-image.yml`, on every push to `main` that touches `apps/api`, `packages/agent` or the
workflow:

1. Build the image from the repository root (the API installs `packages/agent`), tag it with the commit (12 characters) and
   `latest`, push it to GitHub Container Registry. The commit is also baked in (`TKALLEM_VERSION`).
2. Deploy it to Azure App Service with `azure/webapps-deploy`.
3. **Smoke test.** Poll `https://<app>.azurewebsites.net/health` for up to 10 minutes until it reports **the commit that was
   just deployed**, then check that `/scenarios` returns at least one scenario. Otherwise the workflow fails.
4. When the container starts, `start.sh` runs `alembic upgrade head` (unless `RUN_MIGRATIONS=0`), so production is always at
   the schema of its code.

The image runs as a non-root user and contains no `.env` file (`.dockerignore`).

**Web.** Vercel builds `apps/web` (root directory `apps/web`, framework Next.js) on every push and every pull request.

The first-time Azure setup (resource group, plan, Always On, health check, secrets) is scripted in
[`infra/azure/`](../infra/azure/README.md).

## Configuration and secrets

Keys never enter the repository (`.gitignore`, `.dockerignore`). Each lives in exactly one place:

| Where | What |
|---|---|
| `apps/api/.env` (local, ignored by Git) | Everything the API needs on a developer's machine; the example is `apps/api/.env.example` |
| Azure App Service settings | The API's production variables (database, provider keys, Clerk, `GUEST_SECRET`, `DAILY_SPEND_CAP`, pool size) |
| Vercel environment variables | `NEXT_PUBLIC_API_URL`, the Clerk keys (`NEXT_PUBLIC_FEATURE_GROUPS=0` hides the practice groups; they are on when it is absent) |
| GitHub Actions | `AZURE_WEBAPP_PUBLISH_PROFILE` (secret), `AZURE_WEBAPP_NAME` (variable), `OPENROUTER_API_KEY` (secret, for the AI gate) |

CI builds the web app with a fake Clerk key in the right format: a CI build never calls Clerk.

## Monitoring and cost control

| What | How |
|---|---|
| Is the API up, and which version? | `/health` returns the status and the deployed commit; Azure also probes it |
| Is a deploy good? | The smoke test above |
| What did the coach do? | Langfuse traces (off unless configured). They contain the student's text, so the project must stay private |
| Is the bill under control? | `DAILY_SPEND_CAP` (answers per day, everyone together). At 80 % and at 100 % the API logs a warning once a day and posts it to `ALERT_WEBHOOK_URL` if set (a Slack or Discord webhook) |
| Is it fast enough? | The Locust load test in [`apps/api/loadtest/`](../apps/api/loadtest/README.md); the database pool is configurable |

What one answer costs (measured October 2026): about 0.0003 $ typed, 0.0009 $ spoken with Kokoro, 0.0034 $ spoken with
Orpheus. At the default cap of 5000 answers a day, the worst day costs about 17 $ if every answer is spoken with Orpheus,
about 1.5 $ if typed.

## Releases and tags

We use [semantic versioning](https://semver.org): `vMAJOR.MINOR.PATCH`.

- **Patch** (`v0.9.1`): a fix, no new behaviour.
- **Minor** (`v0.10.0`): something new for the student.
- **Major** (`v1.0.0`): the version we hand in. We tag it on the last day, after the final check in a private window.

A release is a tag on a commit of `main` plus a GitHub Release with its notes:

```bash
git checkout main && git pull
git tag -a v0.9.0 -m "v0.9.0"
git push origin v0.9.0
gh release create v0.9.0 --title "v0.9.0" --generate-notes   # then edit the notes by hand
```

The release notes say what changed for the student, the numbers of the evaluation gate at that commit, and the known
limits. The tag lets anyone check out exactly what was judged.

## Rollback

Nothing here is automatic, and we have not rehearsed it under pressure. The ways back, fastest first:

1. **Web:** in Vercel, promote the previous deployment (a few seconds, no rebuild).
2. **API:** every image is kept in GitHub Container Registry under its commit. Point the Azure App Service at the previous
   tag (`ghcr.io/yanou16/tkallem-api:<commit>`), or run the "API image" workflow on the old commit.
3. **Code:** `git revert` the bad pull request and merge it the normal way, through CI.

Database migrations are not rolled back automatically. Write migrations so the previous version of the code still works
with them (add columns, do not rename or drop in the same release).

## Judging-week routine

1 to 7 November.

1. **Before 1 November:** top up OpenRouter and **DeepInfra** (measured on 21 October: DeepInfra answered `402 You need
   positive balance`, so the backup voice did not work). Groq's Orpheus voice is limited on our key to **100 requests a day
   and about 1,200 characters a minute for everybody together** (read from its `x-ratelimit-*` headers); after that Kokoro
   takes over, then the browser's voice. A guest has 100 free answers, so the voice quota is what a jury group runs out of first.
2. **Keep `DAILY_SPEND_CAP=5000`:** judges use a few hundred answers at most. If the 80 % alert comes and the traffic is
   real, raise it in the Azure settings and restart; lower it again on 8 November.
3. **Set `ALERT_WEBHOOK_URL`** to a channel the whole team reads.
4. **Every morning:** open the live link in a private window, logged out, and run one guest visa interview by voice and one
   by typing, then open the report.

## What we do not have yet

We would rather say it:

- No staging environment and no automatic rollback.
- No automatic dependency scanning (Dependabot) and no security headers (CSP, HSTS) on the web app.
- No infrastructure as code beyond the Azure script in `infra/azure/`.
- Rate limits and live connections are in memory, so the API runs as a single instance.
- Sign-in uses a Clerk development instance.
