"""The impact line of the pitch, from real sessions: PYTHONPATH=. python scripts/impact.py   (DATABASE_URL in the environment or .env)

    Confidence (1 to 5), before and after, over N sessions where the student answered both.
Only averages are printed, never a user."""
import psycopg
from psycopg.rows import dict_row

from app.config import settings
from app.db.sessions import confidence_summary

with psycopg.connect(settings.database_url, row_factory=dict_row) as conn:
    r = confidence_summary(conn)
    n = r["sessions"]
    if not n:
        print("No session with both answers yet.")
    else:
        print(f"Average confidence: {r['before']} before, {r['after']} after, over {n} sessions.")
