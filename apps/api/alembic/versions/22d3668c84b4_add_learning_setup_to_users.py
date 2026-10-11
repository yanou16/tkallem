"""add learning setup to users

Revision ID: 22d3668c84b4
Revises: 7acb5ee6e478
Create Date: 2026-10-10 19:27:16.272400

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '22d3668c84b4'
down_revision: Union[str, Sequence[str], None] = '7acb5ee6e478'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE users
            ADD COLUMN daily_goal_minutes SMALLINT NOT NULL DEFAULT 10
                CHECK (daily_goal_minutes IN (5, 10, 15, 20, 30)),
            ADD COLUMN learning_goal TEXT
                CHECK (char_length(learning_goal) <= 200),
            ADD COLUMN practice_mode TEXT
                CHECK (char_length(practice_mode) <= 200),
            ADD COLUMN focus_areas TEXT[] NOT NULL DEFAULT '{}'
                CHECK (focus_areas <@ ARRAY['conversation', 'pronunciation', 'vocabulary',
                                            'grammar', 'fluency', 'confidence']::TEXT[])
    """)


def downgrade() -> None:
    op.execute("""
        ALTER TABLE users
            DROP COLUMN focus_areas,
            DROP COLUMN practice_mode,
            DROP COLUMN learning_goal,
            DROP COLUMN daily_goal_minutes
    """)