"""add rule to corrections

Revision ID: 2412bc4bc6cb
Revises: 22d3668c84b4
Create Date: 2026-10-11 19:04:10.082482

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2412bc4bc6cb'
down_revision: Union[str, Sequence[str], None] = '22d3668c84b4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # The 9 values are written out on purpose: a migration is a frozen snapshot and never imports the app or the agent.
    # Nullable: older corrections have no rule, and the model may leave it out.
    op.execute("""
        ALTER TABLE corrections
            ADD COLUMN rule TEXT
                CHECK (rule IN ('verb_tense', 'subject_verb_agreement', 'verb_pattern', 'preposition', 'article',
                                'plural_uncountable', 'word_order', 'word_form', 'other'))
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE corrections DROP COLUMN rule")
