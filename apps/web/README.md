# Tkallem web

Next.js 14 (App Router) + TypeScript + Tailwind + TanStack Query. **No mock users or fixtures**: every value on screen comes
from the backend (`apps/api`). One temporary exception: the scenario list (see below).

## Run
```bash
cp .env.local.example .env.local   # set NEXT_PUBLIC_API_URL and the Clerk keys
npm install
npm run dev                        # http://localhost:3000, must match FRONTEND_ORIGIN in apps/api/.env
npm test                           # unit tests (Vitest)
```
Sign up at `/sign-up`, then sign in at `/sign-in`. Every API call sends the Clerk session token as a Bearer token
(`src/lib/api/client.ts`).

## Where things live
| What | File |
|---|---|
| Every URL | `src/lib/api/endpoints.ts` |
| Base URL, Bearer token, 401 handling, FastAPI error messages | `src/lib/api/client.ts`, `src/lib/config.ts` |
| API shapes (snake_case `*Dto`) and screen types (camelCase) | `src/features/*/types/*.ts` |
| Calls and `map*` functions (the only place that converts snake_case) | `src/features/*/api/*.ts` |
| User | `src/features/auth/types/user.ts`: name, photo and email from Clerk, learning setup from `GET /me` |

## API routes used
- `GET /me`, `PATCH /me` (only the changed fields): learning setup on the profile.
- `GET /me/progress`: home and progress screens. Times are in seconds, shown in minutes.
- `GET /me/sessions?limit=`: recent sessions on home, practice and profile.
- `POST /sessions`, `POST /sessions/{id}/turn` (form field `text`), `POST /sessions/{id}/end`: a practice session and its report.

Not in the API yet (TODO in the code, the block is hidden or uses the temporary data):
- `GET /scenarios`: until then, the list is copied from `packages/agent/tkallem_agent/scenarios/*.json`
  (`src/features/practice/api/practice.ts`).
- `GET /sessions/{id}`: continue a session, or reload it after a page refresh.
- Audio in `POST /sessions/{id}/turn`: the mic is hidden.
- `GET /me/achievements`, recommendations, today's focus, notifications: hidden.
- Groups (`/api/groups/*`): hidden on home; the Groups pages show their error state until the API exists.

Missing data → the block shows its empty state or is hidden. Never fake data.

Icons: identifiers and scenario ids are mapped in `src/lib/icons.tsx`.
Card colours are cosmetic and assigned by position in the UI.
