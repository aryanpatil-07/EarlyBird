"""Add playbook_rules table

Revision ID: 002
Revises: 001
Create Date: 2026-07-20 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = '002'
down_revision = '001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create playbook_rules table
    op.create_table(
        'playbook_rules',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.String(500)),
        sa.Column('condition_json', sa.JSON(), nullable=False),
        sa.Column('recommendation', sa.String(500), nullable=False),
        sa.Column('priority', sa.Integer(), default=5),
        sa.Column('enabled', sa.Integer(), default=1),
        sa.Column('created_by_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create index on enabled and priority for recommendation queries
    op.create_index(
        'ix_playbook_rules_enabled_priority',
        'playbook_rules',
        ['enabled', 'priority']
    )


def downgrade() -> None:
    # Drop index
    op.drop_index('ix_playbook_rules_enabled_priority')
    
    # Drop table
    op.drop_table('playbook_rules')
