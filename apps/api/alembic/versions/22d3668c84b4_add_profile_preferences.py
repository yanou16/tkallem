"""restore the profile migration referenced by deployed databases

Revision ID: 22d3668c84b4
Revises: 7acb5ee6e478
"""
from typing import Sequence, Union

from alembic import op


revision: str = "22d3668c84b4"
down_revision: Union[str, Sequence[str], None] = "7acb5ee6e478"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE users
            ADD COLUMN IF NOT EXISTS daily_goal_minutes INT,
            ADD COLUMN IF NOT EXISTS learning_goal TEXT,
            ADD COLUMN IF NOT EXISTS practice_mode TEXT,
            ADD COLUMN IF NOT EXISTS focus_areas TEXT[] NOT NULL DEFAULT '{}'
        """
    )


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE users
            DROP COLUMN IF EXISTS daily_goal_minutes,
            DROP COLUMN IF EXISTS learning_goal,
            DROP COLUMN IF EXISTS practice_mode,
            DROP COLUMN IF EXISTS focus_areas
        """
    )
