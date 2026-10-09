# Tkallem web

Next.js 14 (App Router) + TypeScript + Tailwind + TanStack Query. **No mock users or fixtures** — every value on screen comes from the backend.

## Run
```bash
cp .env.local.example .env.local   # set NEXT_PUBLIC_API_URL and NEXT_PUBLIC_AUTH_MODE
npm install
npm run dev
```
Create your test account in the backend (or via /sign-up) and sign in at `/sign-in`.
The API expects Clerk session tokens as Bearer tokens, so keep `NEXT_PUBLIC_AUTH_MODE=bearer`.

## Where to adapt to your backend
| What | File |
|---|---|
| Every URL | `src/lib/api/endpoints.ts` |
| Base URL, cookie vs Bearer, 401 handling | `src/lib/api/client.ts`, `src/lib/config.ts` |
| User shape | `src/features/auth/types/user.ts` |
| Other DTOs | `src/features/*/types/*.ts` |

## Expected responses (shapes live in the types files)
- `GET /me` → current profile (`first_name`, `level`, `explain_lang`) · `PATCH /me`
- `GET /api/dashboard`, `GET /api/mistakes/top`
- `GET /api/practice/{scenarios,sessions/recent,recommended,focus}`
- `POST /api/ai/sessions`, `GET /api/ai/sessions/:id`, `POST …/messages`, `POST …/voice` (multipart `audio`), `POST …/corrections/:id/save`
- `GET /api/groups` (query: search, language, level, topic, voiceRooms, examPrep), `/suggested`, `/sessions/upcoming`, `/topics/active`, `/:id`, `/:id/posts`, join/leave/like/reminder
- `GET /api/progress?range=4w`
- `GET /api/users/me/{achievements,activity,preferences}`, `PATCH …/preferences`, `POST …/avatar`, `POST …/languages`
- `GET /api/notifications/unread-count`

Missing endpoint → that card shows its error state; empty data → its empty state. Never fake data.

Icons: backend sends identifiers (`briefcase`, `plane`, …) mapped in `src/lib/icons.tsx`.
Card colours are cosmetic and assigned by position in the UI.
