"""merge the remaining migration heads

Revision ID: d0e1f2a3b4c5
Revises: ('c9d0e1f2a3b4', '7e1e460646b5')
Create Date: 2026-10-16

"""
from typing import Sequence, Union

from alembic import op


revision: str = "d0e1f2a3b4c5"
down_revision: Union[str, Sequence[str], None] = ("c9d0e1f2a3b4", "7e1e460646b5")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
