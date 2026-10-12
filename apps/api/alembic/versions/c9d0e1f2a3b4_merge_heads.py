"""merge heads

Revision ID: c9d0e1f2a3b4
Revises: ('a1c3d5e7f901', 'b7c8d9e0f1a2')
Create Date: 2026-10-11 23:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c9d0e1f2a3b4'
down_revision: Union[str, Sequence[str], None] = ('a1c3d5e7f901', 'b7c8d9e0f1a2')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
