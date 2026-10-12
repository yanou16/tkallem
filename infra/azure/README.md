# Deploying Tkallem

| Part | Where | Cost |
|---|---|---|
| API (FastAPI, `apps/api`) | Azure App Service, Linux container, plan **B1**, region East US 2 | about 13 $/month, from the Azure for Students credit |
| Front (Next.js, `apps/web`) | Vercel, Hobby plan | free |
| Database | Neon (Ohio), a production branch | free plan |
| Sign-in | Clerk | free plan |
| Language models, voice | OpenRouter, Groq, DeepInfra (pay as you go) | a few dollars, capped by `DAILY_SPEND_CAP` |

Why B1 and not the free F1 tier: F1 stops the app after 60 CPU minutes a day (403 until midnight UTC) and unloads it
after 20 minutes without traffic. B1 has **Always On**: a judge can open the app at any time.

The API is shipped as a Docker image (`apps/api/Dockerfile`, built from the repo root because the API installs
`packages/agent`). GitHub Actions builds it on every push to `main` that touches the API or the agent
(`.github/workflows/api-image.yml`) and pushes it to GitHub Container Registry: `ghcr.io/yanou16/tkallem-api`.

## 1. The image

1. Push to `main` (or run the "API image" workflow by hand in the Actions tab).
2. GitHub > your profile > Packages > `tkallem-api` > Package settings > Change visibility > **Public**.
   The image contains code only (`.dockerignore` excludes every `.env`). If it must stay private, run step 3 with
   `GHCR_USER=<github user> GHCR_TOKEN=<token with read:packages>`.

## 2. The production database

In Neon, create a branch `production` (or a new project in AWS US East 2). Copy its **direct** connection string
(not the `-pooler` one), ending with `?sslmode=require`. Tables are created by the container at start
(`RUN_MIGRATIONS=1` runs `alembic upgrade head`).

## 3. The API on Azure

```bash
brew install azure-cli
az login
cp infra/azure/api.env.example infra/azure/api.env      # fill it in (git-ignored)
APP=tkallem-api-<something-unique> ./infra/azure/deploy.sh
```

The script creates the resource group, the B1 plan and the web app, turns on Always On, HTTPS only and the `/health`
check, copies `api.env` into the app settings (with `WEBSITES_PORT=8000`, `FORWARDED_HOPS=1`), and saves a publish
profile. It can be run again after any change to `api.env`.

Without the command line, the same in the portal: Create a resource > Web App > Publish **Container**, Linux,
East US 2, plan Basic B1 > Container: image source "Other container registries", `ghcr.io/yanou16/tkallem-api:latest`.
Then Settings > Environment variables: everything in `api.env` plus `WEBSITES_PORT=8000` and `FORWARDED_HOPS=1`;
Configuration > General settings: Always On on, HTTPS only; Monitoring > Health check: `/health`.

Check: `https://<APP>.azurewebsites.net/health` answers `{"status":"ok"}` (the first start takes about 2 minutes).

## 4. Automatic deploys

In the GitHub repository > Settings > Secrets and variables > Actions:
- secret `AZURE_WEBAPP_PUBLISH_PROFILE`: the content of `infra/azure/publish-profile.xml` (then delete the file);
- variable `AZURE_WEBAPP_NAME`: the `APP` name.

From then on, every push to `main` that touches the API or the agent builds the image and deploys it.

## 5. The front on Vercel

Import the GitHub repository, root directory `apps/web`, framework Next.js. Environment variables:

| Name | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://<APP>.azurewebsites.net` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk > API keys |
| `CLERK_SECRET_KEY` | Clerk > API keys |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-up` |

Then put the Vercel address in `FRONTEND_ORIGIN` (`infra/azure/api.env`, comma separated if there are several) and
run `deploy.sh` again: the API refuses other origins (CORS and Clerk tokens).

Clerk: the development instance works on the Vercel address and is enough for the competition (judges can do
everything as guests). A production instance needs a domain of our own and our own Google OAuth credentials.

## 6. Before telling anyone the link

In a private window, on a phone (Android and iPhone Safari): open the root address, "Try a visa interview now",
answer by voice and by typing, finish the interview, open the report, "Practice again". `docs/OPERATIONS.md` has the
judging-week routine.

To remove everything: `az group delete -n tkallem`.
