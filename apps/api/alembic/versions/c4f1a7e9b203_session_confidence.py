"""how confident the student feels before and after a session

Revision ID: c4f1a7e9b203
Revises: a1c3d5e7f901
Create Date: 2026-10-13

Two nullable columns, 1 to 5, asked before the first answer and on the report (both can be skipped). They are the
numbers behind "average confidence 2.3 before, 3.8 after over N sessions" (docs/IMPACT.md).
"""
from typing import Sequence, Union

from alembic import op

revision: str = "c4f1a7e9b203"
down_revision: Union[str, Sequence[str], None] = "a1c3d5e7f901"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE practice_sessions ADD COLUMN confidence_before SMALLINT CHECK (confidence_before BETWEEN 1 AND 5)")
    op.execute("ALTER TABLE practice_sessions ADD COLUMN confidence_after SMALLINT CHECK (confidence_after BETWEEN 1 AND 5)")


def downgrade() -> None:
    op.execute("ALTER TABLE practice_sessions DROP COLUMN confidence_after")
    op.execute("ALTER TABLE practice_sessions DROP COLUMN confidence_before")
