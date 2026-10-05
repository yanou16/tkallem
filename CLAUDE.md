# Tkallem — instructions for Claude Code

Tkallem is an AI English speaking coach for Algerian students (Next.js PWA + FastAPI + LangGraph agent).

## Before touching UI
Read `docs/DESIGN.md`. Use only tokens from `tokens.css` / `tailwind.preset.ts`. Build on shadcn/ui components restyled with these tokens. Never add colors, fonts, radii or shadows that are not in the design system.

## Ownership (do not edit outside your area without a pull request reviewed by its owner)
- `apps/web/` — Front and design (Person C)
- `apps/api/` — Back and voice (Person B)
- `packages/agent/` — AI agent and prompts (Rayane)
- `packages/agent/tkallem_agent/scenarios/` — scenario content (Rayane); questions come from real sources and are reviewed by the team
- `packages/contracts/` — shared API and agent schemas: change only by a pull request approved by all three

## Contracts first
- The API contract is `packages/contracts/openapi.yaml`. The agent contract is `packages/contracts/agent_turn.schema.json`.
- If a task needs a contract change, stop and propose the change in a separate pull request.
- Front works against mocks generated from the contract until the real endpoint exists.

## Rules
- Small pull requests, one feature each, against `main` (protected, 1 review required).
- Never commit secrets. API keys only in `.env` files on the server side.
- Every agent prompt change must re-run `packages/agent/evals/run_evals.py` (French and English) and `evals/injection.py`.
