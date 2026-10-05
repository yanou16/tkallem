# Tkallem

AI speaking coach for Algerian students: practice real English conversations (visa, Campus France, remote interview, IELTS part 2) by voice or text, get corrections explained in French, and see progress in numbers. Provisional name, to be confirmed by the team.

## Structure
- `apps/api/` FastAPI + Pydantic, voice pipeline (`app/voice`), scenario JSON files (`app/scenarios`), pytest
- `packages/agent/` LangGraph agent, prompts, evals (30-sentence correction set)
- `packages/contracts/` OpenAPI + agent turn JSON schema (shared, change by PR approved by all three)
- `docs/DESIGN.md` design system; read `CLAUDE.md` for ownership rules
- `apps/web/` Next.js PWA, Tailwind, shadcn/ui, Framer Motion, Clerk auth

## Run
```bash
# backend (http://localhost:8000)
cd apps/api && .venv/bin/uvicorn app.main:app --reload
cd apps/api && .venv/bin/pytest

# frontend (http://localhost:3000)
cd apps/web && npm run dev
```

Copy `apps/api/.env.example` to `apps/api/.env` and `apps/web/.env.example` to `frontend/.env.local`, then fill in the keys (API keys server-side only).

## Add a scenario
Add a JSON file in `apps/api/app/scenarios/` (see `visa-us.json`): `id`, `title`, `coach_role`, `questions`, `goals`, `useful_words`.

## Not installed yet
Kokoro TTS (pulls PyTorch, install when the voice pipeline starts) and LiveKit Agents (Should, week 3).

## Auth and database
Neon (Postgres, auto-wakes, never freezes) and Clerk (auth). The API verifies Clerk JWTs and filters every query by `user_id`. Before a live demo, open the app 5 minutes early to wake the database.
