"""Seed initial users

Revision ID: 004
Revises: 003
Create Date: 2026-07-20 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from datetime import datetime

# revision identifiers
revision = '004'
down_revision = '003'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Seed default users for testing/demo."""
    users_table = sa.table(
        'users',
        sa.column('user_id', sa.String()),
        sa.column('role', sa.String()),
        sa.column('created_at', sa.DateTime()),
    )
    
    op.bulk_insert(users_table, [
        {
            'user_id': '1',
            'role': 'REVIEWER',
            'created_at': datetime.utcnow(),
        },
        {
            'user_id': '2',
            'role': 'TEAM_LEAD',
            'created_at': datetime.utcnow(),
        },
    ])


def downgrade() -> None:
    """Remove seeded users."""
    op.execute("DELETE FROM users WHERE user_id IN ('1', '2')")
