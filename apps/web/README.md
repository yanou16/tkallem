# Tkallem web

Next.js 14 (App Router) + TypeScript + Tailwind + TanStack Query. **No mock users or fixtures**: every value on screen comes
from the backend (`apps/api`).

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
- `GET /me/progress`: home and progress screens. Times are in seconds, shown in minutes; practice time counts spoken
  time, or the length of a text session (30 minutes at most).
- `GET /me/sessions?limit=`: recent sessions on home, practice and profile.
- `GET /me/achievements`: badges on the profile (the full catalog, locked ones greyed out).
- `GET /scenarios`: scenario cards. `description`, `category`, `level` and `icon` are null until the agent has them
  (the icon then falls back to the scenario id, mapped in `src/lib/icons.tsx`).
- `POST /sessions`, `POST /sessions/{id}/turn` (form field `text`), `POST /sessions/{id}/end`: a practice session and its report.
- `GET /sessions/{id}`: continue a session or reload it after a page refresh. For an ended session, only the note,
  metrics and answers are stored: no traffic light per metric, no answer to redo.

Voice calls:
- The AI Chat voice mode uses a continuous Pipecat SmallWebRTC session at
  `POST /sessions/{id}/webrtc` (with `PATCH` for trickle ICE). Start the call to grant
  microphone access; speaking and interruptions are handled by WebRTC/VAD without a
  Send button.
- The API must have `OPENROUTER_API_KEY`, a configured `STT_PROVIDER` key, and a
  configured `TTS_PROVIDER` key. `DATABASE_URL` and Clerk settings are also required
  for authenticated sessions. Set `FRONTEND_ORIGIN` to the web app origin.

Other not-yet-implemented areas:
- Recommendations, today's focus, notifications.
- Groups (`/api/groups/*`): hidden on home; the Groups pages show their error state until the API exists.

Missing data → the block shows its empty state or is hidden. Never fake data.

Icons: identifiers and scenario ids are mapped in `src/lib/icons.tsx`.
Card colours are cosmetic and assigned by position in the UI.
