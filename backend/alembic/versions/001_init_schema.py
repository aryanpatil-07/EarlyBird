"""Initial schema creation

Revision ID: 001
Revises: 
Create Date: 2026-07-20 11:30:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create users table
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.String(50), nullable=False),
        sa.Column('role', sa.String(20), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id')
    )
    op.create_index('ix_users_user_id', 'users', ['user_id'])

    # Create entities table
    op.create_table(
        'entities',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('entity_type', sa.String(50), nullable=False),
        sa.Column('entity_identifier', sa.String(255), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )

    # Create transactions table
    op.create_table(
        'transactions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('transaction_id', sa.String(50), nullable=False),
        sa.Column('card_id', sa.String(255), nullable=False),
        sa.Column('merchant_id', sa.String(255), nullable=True),
        sa.Column('amount', sa.Float(), nullable=False),
        sa.Column('timestamp', sa.DateTime(), nullable=False),
        sa.Column('label', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('transaction_id')
    )
    op.create_index('ix_transactions_card_id', 'transactions', ['card_id'])
    op.create_index('ix_transactions_timestamp', 'transactions', ['timestamp'])
    op.create_index('ix_transactions_created_at', 'transactions', ['created_at'])

    # Create anomalies table (for M1)
    op.create_table(
        'anomalies',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('transaction_id', sa.Integer(), nullable=False),
        sa.Column('score', sa.Float(), nullable=False),
        sa.Column('baseline', sa.Float(), nullable=False),
        sa.Column('deviation', sa.Float(), nullable=False),
        sa.Column('evidence', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_anomalies_transaction_id', 'anomalies', ['transaction_id'])
    op.create_index('ix_anomalies_created_at', 'anomalies', ['created_at'])

    # Create cases table (for M3)
    op.create_table(
        'cases',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('case_id', sa.String(50), nullable=False),
        sa.Column('state', sa.String(20), nullable=False),
        sa.Column('severity', sa.String(20), nullable=False),
        sa.Column('priority', sa.Integer(), nullable=False),
        sa.Column('version', sa.Integer(), nullable=False),
        sa.Column('recommendations', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('resolved_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('case_id')
    )
    op.create_index('ix_cases_state', 'cases', ['state'])
    op.create_index('ix_cases_created_at', 'cases', ['created_at'])

    # Create root_cause_links table (for M2)
    op.create_table(
        'root_cause_links',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('anomaly_id', sa.Integer(), nullable=False),
        sa.Column('related_anomaly_id', sa.Integer(), nullable=False),
        sa.Column('link_type', sa.String(50), nullable=False),
        sa.Column('evidence', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_root_cause_links_anomaly_id', 'root_cause_links', ['anomaly_id'])

    # Create playbook_rules table (for M4)
    op.create_table(
        'playbook_rules',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('condition_json', sa.JSON(), nullable=False),
        sa.Column('recommendation', sa.Text(), nullable=False),
        sa.Column('created_by', sa.String(50), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_playbook_rules_created_at', 'playbook_rules', ['created_at'])

    # Create knowledge_base table (for M5)
    op.create_table(
        'knowledge_base',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('case_id', sa.String(50), nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('ts', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_knowledge_base_case_id', 'knowledge_base', ['case_id'])
    op.create_index('ix_knowledge_base_created_at', 'knowledge_base', ['created_at'])

    # Create audit_log table (for M3)
    op.create_table(
        'audit_log',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('entity_type', sa.String(50), nullable=False),
        sa.Column('entity_id', sa.String(50), nullable=False),
        sa.Column('action', sa.String(50), nullable=False),
        sa.Column('actor_id', sa.String(50), nullable=False),
        sa.Column('changes', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_audit_log_entity_type', 'audit_log', ['entity_type'])
    op.create_index('ix_audit_log_entity_id', 'audit_log', ['entity_id'])
    op.create_index('ix_audit_log_created_at', 'audit_log', ['created_at'])


def downgrade() -> None:
    # Drop tables in reverse order
    op.drop_table('audit_log')
    op.drop_table('knowledge_base')
    op.drop_table('playbook_rules')
    op.drop_table('root_cause_links')
    op.drop_table('cases')
    op.drop_table('anomalies')
    op.drop_table('transactions')
    op.drop_table('entities')
    op.drop_table('users')
