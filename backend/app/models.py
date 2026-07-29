"""
SQLAlchemy ORM models — Reconciled schema for EarlyBird Phase 1.

Models: User, Entity, Transaction, Anomaly, Case, RootCauseLink, PlaybookRule, KnowledgeBase, AuditLog.
"""

from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text, JSON, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime

Base = declarative_base()


class User(Base):
    """User model — REVIEWERs and TEAM_LEADs."""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=True)
    role = Column(String(20), nullable=False)  # REVIEWER or TEAM_LEAD
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<User(user_id={self.user_id}, name={self.name}, role={self.role})>"


class Entity(Base):
    """Entity model — Cards, merchants, etc."""
    __tablename__ = "entities"

    id = Column(Integer, primary_key=True, index=True)
    entity_type = Column(String(50), nullable=False)  # 'card', 'merchant', etc.
    entity_identifier = Column(String(255), nullable=False, index=True)  # card number, merchant ID
    created_at = Column(DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<Entity(type={self.entity_type}, id={self.entity_identifier})>"


class Transaction(Base):
    """Transaction model — Credit card transactions from Kaggle dataset."""
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    transaction_id = Column(String(50), unique=True, index=True)
    card_id = Column(String(255), nullable=False, index=True)
    merchant_id = Column(String(255), nullable=True, index=True)
    amount = Column(Float, nullable=False)
    timestamp = Column(DateTime, nullable=False, index=True)
    label = Column(Integer, nullable=True)  # 0 = legitimate, 1 = fraud (from dataset)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    def __repr__(self):
        return f"<Transaction(id={self.transaction_id}, card={self.card_id}, amount={self.amount})>"


class Anomaly(Base):
    """Anomaly model — Detection results with z-score and evidence snapshot."""
    __tablename__ = "anomalies"

    id = Column(Integer, primary_key=True, index=True)
    transaction_id = Column(Integer, nullable=False, index=True)
    entity_id = Column(String(255), nullable=True, index=True)
    metric = Column(String(50), default="amount", nullable=False)
    severity = Column(String(20), default="HIGH", nullable=False)
    score = Column(Float, nullable=False)  # z-score
    baseline = Column(Float, nullable=False)  # baseline mean
    deviation = Column(Float, nullable=False)  # deviation from baseline
    observed_value = Column(Float, nullable=True)  # observed value (e.g. transaction amount)
    evidence = Column(JSON, nullable=True)  # JSON with why anomaly fired
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    def __repr__(self):
        return f"<Anomaly(id={self.id}, tx_id={self.transaction_id}, score={self.score})>"


class Case(Base):
    """Case model — Grouped anomalies with state machine, SLA, and versioning."""
    __tablename__ = "cases"

    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(String(50), unique=True, index=True, nullable=False)
    anomaly_id = Column(Integer, ForeignKey("anomalies.id"), nullable=True, index=True)
    state = Column(String(20), nullable=False, index=True, default="NEW")  # NEW, ACKNOWLEDGED, RESOLVED, ESCALATED
    severity = Column(String(20), nullable=False, default="HIGH")  # HIGH, MEDIUM, LOW
    priority = Column(Integer, nullable=False, default=1)  # 1 (high) to 5 (low)
    assigned_to = Column(String(50), nullable=True, index=True)
    sla_deadline = Column(DateTime, nullable=True, index=True)
    duplicate_count = Column(Integer, default=1, nullable=False)
    version = Column(Integer, default=1, nullable=False)  # Optimistic concurrency control
    recommendations = Column(JSON, nullable=True)  # Array of recommendation objects
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)

    def __repr__(self):
        return f"<Case(id={self.case_id}, state={self.state}, severity={self.severity})>"


class RootCauseLink(Base):
    """Root cause link model — Correlations between anomalies and context transactions."""
    __tablename__ = "root_cause_links"

    id = Column(Integer, primary_key=True, index=True)
    anomaly_id = Column(Integer, nullable=False, index=True)
    related_anomaly_id = Column(Integer, nullable=True)
    related_transaction_id = Column(String(50), nullable=True)
    link_type = Column(String(50), nullable=False)  # 'same_entity', 'velocity_spike', 'high_amount'
    correlation_strength = Column(Float, default=1.0, nullable=False)
    explanation = Column(Text, nullable=True)
    evidence = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<RootCauseLink(from={self.anomaly_id}, type={self.link_type}, strength={self.correlation_strength})>"


class PlaybookRule(Base):
    """Playbook rule model — Team Lead-defined rules for deterministic recommendations."""
    __tablename__ = "playbook_rules"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(String(500), nullable=True)
    condition_json = Column(JSON, nullable=False)  # e.g. {"amount_min": 5000}
    recommendation = Column(String(500), nullable=False)
    priority = Column(Integer, default=5, nullable=False)  # 1-10 priority level
    enabled = Column(Integer, default=1, nullable=False)  # 1=enabled, 0=disabled (soft delete)
    created_by_id = Column(Integer, nullable=False, default=2)  # user ID of Team Lead
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<PlaybookRule(id={self.id}, name={self.name}, priority={self.priority})>"


class KnowledgeBase(Base):
    """Knowledge base model — Auto-generated from resolved cases."""
    __tablename__ = "knowledge_base"

    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(String(50), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)  # Markdown
    summary = Column(Text, nullable=True)
    root_cause_summary = Column(Text, nullable=True)
    decision_summary = Column(Text, nullable=True)
    ts = Column(String, nullable=True)  # PostgreSQL tsvector representation
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    def __repr__(self):
        return f"<KnowledgeBase(case_id={self.case_id}, title={self.title})>"


class AuditLog(Base):
    """Audit log model — Append-only event log for all system and user state changes."""
    __tablename__ = "audit_log"

    id = Column(Integer, primary_key=True, index=True)
    entity_type = Column(String(50), nullable=False, index=True)  # 'case', 'playbook_rule', etc.
    entity_id = Column(String(50), nullable=False, index=True)
    action = Column(String(50), nullable=False)  # 'CREATE', 'UPDATE', 'DELETE', 'STATE_CHANGE'
    actor_id = Column(String(50), nullable=False)  # user_id or 'SYSTEM'
    actor_type = Column(String(20), default="USER", nullable=False)  # 'USER' or 'SYSTEM'
    reason = Column(Text, nullable=True)
    changes = Column(JSON, nullable=True)  # {old: {field: value}, new: {field: value}}
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    def __repr__(self):
        return f"<AuditLog(entity={self.entity_type}:{self.entity_id}, action={self.action}, actor={self.actor_id})>"
