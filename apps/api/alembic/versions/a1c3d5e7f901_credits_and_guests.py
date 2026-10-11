"""credits and guest mode

Revision ID: a1c3d5e7f901
Revises: 7acb5ee6e478
Create Date: 2026-10-11

A guest is a row of `users` whose clerk_user_id is 'guest:<uuid>': every table that points at users (practice
sessions, turns, progress) works for guests without any change. `guest_ip_hash` is a keyed hash of the network
address, never the address itself, used only to cap how many guests one address can create per day.
"""
from typing import Sequence, Union

from alembic import op

revision: str = "a1c3d5e7f901"
down_revision: Union[str, Sequence[str], None] = "7acb5ee6e478"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE users ADD COLUMN guest_ip_hash TEXT")
    op.execute("CREATE INDEX idx_users_guest_ip ON users (guest_ip_hash, created_at) WHERE guest_ip_hash IS NOT NULL")

    op.execute("""
        CREATE TABLE credit_wallets (
            user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            balance INT NOT NULL CHECK (balance >= 0),
            last_refill_on DATE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)

    op.execute("""
        CREATE TABLE credit_ledger (
            id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            delta INT NOT NULL,
            reason TEXT NOT NULL CHECK (reason IN
                ('guest_grant', 'login_bonus', 'daily_refill', 'guest_transfer', 'turn_spent', 'refund')),
            balance_after INT NOT NULL,
            session_id UUID,
            ref TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            UNIQUE (user_id, ref)
        )
    """)
    op.execute("CREATE INDEX idx_credit_ledger_day ON credit_ledger (created_at) WHERE reason IN ('turn_spent', 'refund')")


def downgrade() -> None:
    op.execute("DROP TABLE credit_ledger")
    op.execute("DROP TABLE credit_wallets")
    op.execute("DROP INDEX idx_users_guest_ip")
    op.execute("ALTER TABLE users DROP COLUMN guest_ip_hash")
