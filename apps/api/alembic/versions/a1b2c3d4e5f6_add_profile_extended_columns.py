"""add profile extended columns to users

Revision ID: a1b2c3d4e5f6
Revises: 7acb5ee6e478
Create Date: 2026-10-10 21:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '22d3668c84b4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE users
            ADD COLUMN IF NOT EXISTS last_name TEXT,
            ADD COLUMN IF NOT EXISTS avatar_url TEXT,
            ADD COLUMN IF NOT EXISTS bio TEXT,
            ADD COLUMN IF NOT EXISTS learning_goal TEXT,
            ADD COLUMN IF NOT EXISTS daily_goal_minutes INT,
            ADD COLUMN IF NOT EXISTS preferred_practice_mode TEXT
                CHECK (preferred_practice_mode IN ('text', 'voice', 'both')),
            ADD COLUMN IF NOT EXISTS focus_areas TEXT[] NOT NULL DEFAULT '{}',
            ADD COLUMN IF NOT EXISTS learning_languages JSONB NOT NULL DEFAULT '[]',
            ADD COLUMN IF NOT EXISTS preferences JSONB NOT NULL DEFAULT '{}'
    """)


def downgrade() -> None:
    op.execute("""
        ALTER TABLE users
            DROP COLUMN IF EXISTS last_name,
            DROP COLUMN IF EXISTS avatar_url,
            DROP COLUMN IF EXISTS bio,
            DROP COLUMN IF EXISTS learning_goal,
            DROP COLUMN IF EXISTS daily_goal_minutes,
            DROP COLUMN IF EXISTS preferred_practice_mode,
            DROP COLUMN IF EXISTS focus_areas,
            DROP COLUMN IF EXISTS learning_languages,
            DROP COLUMN IF EXISTS preferences
    """)
