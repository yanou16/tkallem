# Tkallem

AI speaking coach for Algerian students: practice real English conversations (visa, Campus France, remote interview, IELTS part 2) by voice or text, get corrections explained in French, and see progress in numbers. Provisional name, to be confirmed by the team.

## Structure
- `apps/api/` FastAPI + Pydantic, voice pipeline (`app/voice`), pytest
- `packages/agent/` the AI coach (`CoachSession`), prompts, scenario JSON files, evals: see `packages/agent/README.md` and `docs/agent-integration.md`
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
Add a JSON file in `packages/agent/scenarios/` (see `visa-us.json`): `id` (= file name), `title`, `mode`, `minutes`, `coach_role`, 6 `questions`, one goal id per question, `useful_words`. `pytest` in `packages/agent` validates it.

## Not installed yet
Kokoro TTS (pulls PyTorch, install when the voice pipeline starts) and LiveKit Agents (Should, week 3).

## Auth and database
Neon (Postgres, auto-wakes, never freezes) and Clerk (auth). The API verifies Clerk JWTs and filters every query by `user_id`. Before a live demo, open the app 5 minutes early to wake the database.
