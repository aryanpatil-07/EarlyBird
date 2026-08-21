"""Add knowledge_base table with full-text search support

Revision ID: 003
Revises: 002
Create Date: 2026-07-20 13:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = '003'
down_revision = '002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    
    if not inspector.has_table('knowledge_base'):
        op.create_table(
            'knowledge_base',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('case_id', sa.String(50), nullable=False, index=True),
            sa.Column('title', sa.String(255), nullable=False),
            sa.Column('content', sa.Text(), nullable=False),
            sa.Column('ts', sa.Text(), nullable=True),  # PostgreSQL tsvector
            sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), index=True),
            sa.PrimaryKeyConstraint('id')
        )
        
        # Create full-text search index on tsvector column
        op.execute(
            "CREATE INDEX IF NOT EXISTS ix_knowledge_base_ts ON knowledge_base USING GIN(to_tsvector('english', content))"
        )
        
        # Create index on case_id for lookups
        op.create_index(
            'ix_knowledge_base_case_id',
            'knowledge_base',
            ['case_id'],
            if_not_exists=True
        )
        
        # Create index on created_at for time-based queries
        op.create_index(
            'ix_knowledge_base_created_at',
            'knowledge_base',
            ['created_at'],
            if_not_exists=True
        )


def downgrade() -> None:
    # Drop indices
    op.drop_index('ix_knowledge_base_ts')
    op.drop_index('ix_knowledge_base_case_id')
    op.drop_index('ix_knowledge_base_created_at')
    
    # Drop table
    op.drop_table('knowledge_base')
