"""allow custom profile focus areas

Revision ID: b7c8d9e0f1a2
Revises: a1b2c3d4e5f6
"""
from typing import Sequence, Union

from alembic import op


revision: str = "b7c8d9e0f1a2"
down_revision: Union[str, Sequence[str], None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE users DROP CONSTRAINT IF EXISTS users_focus_areas_check"
    )


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE users
        ADD CONSTRAINT users_focus_areas_check
        CHECK (
            focus_areas <@ ARRAY[
                'conversation',
                'pronunciation',
                'vocabulary',
                'grammar',
                'fluency',
                'confidence'
            ]::text[]
        )
        """
    )
