"""new profiles get explanations in English by default

The jury and visitors may read English only: the report, the notes and the explanations of the corrections now start in English
(the "Explain in English | French" switch is always there). Students who already have a profile keep what they have.

Revision ID: e1f2a3b4c5d6
Revises: d0e1f2a3b4c5
Create Date: 2026-10-21

"""
from typing import Sequence, Union

from alembic import op


revision: str = "e1f2a3b4c5d6"
down_revision: Union[str, Sequence[str], None] = "d0e1f2a3b4c5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE users ALTER COLUMN explain_lang SET DEFAULT 'en'")


def downgrade() -> None:
    op.execute("ALTER TABLE users ALTER COLUMN explain_lang SET DEFAULT 'fr'")
