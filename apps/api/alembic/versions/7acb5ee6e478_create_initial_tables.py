"""create initial tables

Revision ID: 7acb5ee6e478
Revises: 
Create Date: 2026-10-05 22:05:13.870904

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7acb5ee6e478'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE users (
            id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            clerk_user_id TEXT NOT NULL UNIQUE,
            img TEXT ,
            email TEXT,
            first_name TEXT,
            level TEXT CHECK (level IN ('A2', 'B1', 'B2', 'C1')),
            explain_lang TEXT NOT NULL DEFAULT 'fr' CHECK (explain_lang IN ('en', 'fr')),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)

    op.execute("""
        CREATE TABLE practice_sessions (
            id UUID PRIMARY KEY,
            user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            scenario_id TEXT NOT NULL,
            mode TEXT NOT NULL DEFAULT 'text' CHECK (mode IN ('text', 'voice')),
            explain_lang TEXT NOT NULL CHECK (explain_lang IN ('en', 'fr')),
            state JSONB NOT NULL,
            note TEXT,
            started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            ended_at TIMESTAMPTZ
        )
    """)

    op.execute("""
        CREATE TABLE turns (
            id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            session_id UUID NOT NULL REFERENCES practice_sessions(id) ON DELETE CASCADE,
            position INT NOT NULL,
            transcript TEXT NOT NULL,
            reply TEXT NOT NULL,
            sentence_status TEXT NOT NULL CHECK (sentence_status IN ('green', 'orange', 'red')),
            goal_covered TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            UNIQUE (session_id, position)
        )
    """)

    op.execute("""
        CREATE TABLE corrections (
            id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            turn_id BIGINT NOT NULL REFERENCES turns(id) ON DELETE CASCADE,
            original TEXT NOT NULL,
            fixed TEXT NOT NULL,
            type TEXT NOT NULL CHECK (type IN ('grammar', 'vocabulary', 'word_choice', 'other')),
            why TEXT NOT NULL
        )
    """)

    op.execute("""
        CREATE TABLE session_metrics (
            session_id UUID PRIMARY KEY REFERENCES practice_sessions(id) ON DELETE CASCADE,
            words INT NOT NULL,
            mistakes_per_100 REAL,
            words_per_answer REAL,
            hesitations_per_min REAL,
            speaking_seconds REAL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)

    op.execute("CREATE INDEX idx_practice_sessions_user ON practice_sessions (user_id, started_at)")
    op.execute("CREATE INDEX idx_corrections_turn ON corrections (turn_id)")


def downgrade() -> None:
    op.execute("DROP TABLE session_metrics")
    op.execute("DROP TABLE corrections")
    op.execute("DROP TABLE turns")
    op.execute("DROP TABLE practice_sessions")
    op.execute("DROP TABLE users")