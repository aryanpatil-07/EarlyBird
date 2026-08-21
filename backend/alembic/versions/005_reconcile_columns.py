"""Reconcile missing columns across models

Revision ID: 005
Revises: 004
Create Date: 2026-08-21 12:30:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = '005'
down_revision = '004'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    
    # Check users table columns
    if inspector.has_table('users'):
        cols = {c['name'] for c in inspector.get_columns('users')}
        if 'name' not in cols:
            op.add_column('users', sa.Column('name', sa.String(100), nullable=True))
        if 'is_active' not in cols:
            op.add_column('users', sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False))

    # Check cases table columns
    if inspector.has_table('cases'):
        cols = {c['name'] for c in inspector.get_columns('cases')}
        if 'anomaly_id' not in cols:
            op.add_column('cases', sa.Column('anomaly_id', sa.Integer(), nullable=True))
        if 'assigned_to' not in cols:
            op.add_column('cases', sa.Column('assigned_to', sa.String(50), nullable=True))
        if 'sla_deadline' not in cols:
            op.add_column('cases', sa.Column('sla_deadline', sa.DateTime(), nullable=True))
        if 'duplicate_count' not in cols:
            op.add_column('cases', sa.Column('duplicate_count', sa.Integer(), server_default='1', nullable=False))

    # Check anomalies table columns
    if inspector.has_table('anomalies'):
        cols = {c['name'] for c in inspector.get_columns('anomalies')}
        if 'entity_id' not in cols:
            op.add_column('anomalies', sa.Column('entity_id', sa.String(255), nullable=True))
        if 'metric' not in cols:
            op.add_column('anomalies', sa.Column('metric', sa.String(50), server_default='amount', nullable=False))
        if 'severity' not in cols:
            op.add_column('anomalies', sa.Column('severity', sa.String(20), server_default='HIGH', nullable=False))
        if 'observed_value' not in cols:
            op.add_column('anomalies', sa.Column('observed_value', sa.Float(), nullable=True))

    # Check audit_log table columns
    if inspector.has_table('audit_log'):
        cols = {c['name'] for c in inspector.get_columns('audit_log')}
        if 'actor_type' not in cols:
            op.add_column('audit_log', sa.Column('actor_type', sa.String(20), server_default='USER', nullable=False))
        if 'reason' not in cols:
            op.add_column('audit_log', sa.Column('reason', sa.Text(), nullable=True))


def downgrade() -> None:
    pass
