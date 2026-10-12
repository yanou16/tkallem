"""create groups

Revision ID: 7e1e460646b5
Revises: a1c3d5e7f901
Create Date: 2026-10-12 21:28:27.417961

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7e1e460646b5'
down_revision: Union[str, Sequence[str], None] = 'a1c3d5e7f901'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Practice groups (written English between students of the same level). Groups are created by the API only.
    op.execute("""
        CREATE TABLE groups (
            id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            level TEXT NOT NULL CHECK (level IN ('A2', 'B1', 'B2', 'C1')),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX idx_groups_level ON groups (level)")

    # One group at a time per student: UNIQUE (user_id). Leaving a group deletes the row.
    op.execute("""
        CREATE TABLE group_members (
            group_id BIGINT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
            user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            PRIMARY KEY (group_id, user_id),
            UNIQUE (user_id)
        )
    """)

    # Messages keep their author after they leave ("former member" = no membership row). hidden_at: hidden by reports.
    op.execute("""
        CREATE TABLE group_messages (
            id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            group_id BIGINT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
            user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            hidden_at TIMESTAMPTZ
        )
    """)
    op.execute("CREATE INDEX idx_group_messages_group ON group_messages (group_id, id)")

    # One report per member and message: the primary key is the UNIQUE (message_id, reporter_id).
    op.execute("""
        CREATE TABLE message_reports (
            message_id BIGINT NOT NULL REFERENCES group_messages(id) ON DELETE CASCADE,
            reporter_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            reason TEXT NOT NULL CHECK (reason IN ('insult', 'harassment', 'spam', 'other')),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            PRIMARY KEY (message_id, reporter_id)
        )
    """)


def downgrade() -> None:
    op.execute("DROP TABLE message_reports")
    op.execute("DROP TABLE group_messages")
    op.execute("DROP TABLE group_members")
    op.execute("DROP TABLE groups")
