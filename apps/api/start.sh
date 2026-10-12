#!/bin/sh
# Container start: database migrations (unless RUN_MIGRATIONS=0), then the API on $PORT (default 8000).
# One process: the in-memory guards (voice provider resting, replay limits, budget cache) stay consistent; the
# blocking LLM and voice calls run in threads.
set -e
if [ "${RUN_MIGRATIONS:-1}" = "1" ]; then
  alembic upgrade head
fi
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --timeout-keep-alive 75
