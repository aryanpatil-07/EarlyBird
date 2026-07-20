"""
SQLAlchemy ORM models — Base schema for EarlyBird.

Phase 0: Base entities (users, transactions, entities).
Subsequent phases add: anomalies, cases, root_cause_links, playbook_rules, knowledge_base, audit_log.
"""

from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text, JSON, Enum as SQLEnum
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime
import enum

Base = declarative_base()


class User(Base):
    """User model — REVIEWERs and TEAM_LEADs."""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(50), unique=True, index=True, nullable=False)
    role = Column(String(20), nullable=False)  # REVIEWER or TEAM_LEAD
    created_at = Column(DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<User(user_id={self.user_id}, role={self.role})>"


class Entity(Base):
    """Entity model — Cards, merchants, etc."""
    __tablename__ = "entities"

    id = Column(Integer, primary_key=True, index=True)
    entity_type = Column(String(50), nullable=False)  # 'card', 'merchant', etc.
    entity_identifier = Column(String(255), nullable=False)  # card number, merchant ID
    created_at = Column(DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<Entity(type={self.entity_type}, id={self.entity_identifier})>"


class Transaction(Base):
    """Transaction model — Credit card transactions from Kaggle dataset."""
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    transaction_id = Column(String(50), unique=True, index=True)
    card_id = Column(String(255), nullable=False, index=True)
    merchant_id = Column(String(255), nullable=True)
    amount = Column(Float, nullable=False)
    timestamp = Column(DateTime, nullable=False, index=True)
    label = Column(Integer, nullable=True)  # 0 = legitimate, 1 = fraud (from dataset)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    def __repr__(self):
        return f"<Transaction(id={self.transaction_id}, card={self.card_id}, amount={self.amount})>"


class Anomaly(Base):
    """Anomaly model — Detection results (created in M1)."""
    __tablename__ = "anomalies"

    id = Column(Integer, primary_key=True, index=True)
    transaction_id = Column(Integer, nullable=False, index=True)
    score = Column(Float, nullable=False)  # z-score
    baseline = Column(Float, nullable=False)  # baseline mean
    deviation = Column(Float, nullable=False)  # deviation from baseline
    evidence = Column(JSON, nullable=True)  # JSON with why anomaly fired
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    def __repr__(self):
        return f"<Anomaly(tx_id={self.transaction_id}, score={self.score})>"


class Case(Base):
    """Case model — Grouped anomalies with state machine (created in M3)."""
    __tablename__ = "cases"

    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(String(50), unique=True, index=True)
    state = Column(String(20), nullable=False, index=True)  # NEW, ACCEPTED, RESOLVED, ESCALATED
    severity = Column(String(20), nullable=False)  # HIGH, MEDIUM, LOW
    priority = Column(Integer, nullable=False)  # 1 (high) to 5 (low)
    version = Column(Integer, default=1)  # Optimistic concurrency control
    recommendations = Column(JSON, nullable=True)  # Array of recommendation objects
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)

    def __repr__(self):
        return f"<Case(id={self.case_id}, state={self.state}, severity={self.severity})>"


class RootCauseLink(Base):
    """Root cause link model — Correlations between anomalies (created in M2)."""
    __tablename__ = "root_cause_links"

    id = Column(Integer, primary_key=True, index=True)
    anomaly_id = Column(Integer, nullable=False, index=True)
    related_anomaly_id = Column(Integer, nullable=False)
    link_type = Column(String(50), nullable=False)  # 'same_entity', 'same_merchant', 'amount_pattern'
    evidence = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<RootCauseLink(from={self.anomaly_id}, to={self.related_anomaly_id}, type={self.link_type})>"


class PlaybookRule(Base):
    """Playbook rule model — Team Lead-defined rules (created in M4)."""
    __tablename__ = "playbook_rules"

    id = Column(Integer, primary_key=True, index=True)
    condition_json = Column(JSON, nullable=False)  # e.g., {"entity_type": "card", "amount_min": 5000}
    recommendation = Column(Text, nullable=False)
    created_by = Column(String(50), nullable=False)  # user_id
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<PlaybookRule(id={self.id}, created_by={self.created_by})>"


class KnowledgeBase(Base):
    """Knowledge base model — Auto-generated from resolved cases (created in M5)."""
    __tablename__ = "knowledge_base"

    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(String(50), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)  # Markdown
    ts = Column(String, nullable=True)  # PostgreSQL tsvector for full-text search
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    def __repr__(self):
        return f"<KnowledgeBase(case_id={self.case_id}, title={self.title})>"


class AuditLog(Base):
    """Audit log model — Append-only event log (created in M3)."""
    __tablename__ = "audit_log"

    id = Column(Integer, primary_key=True, index=True)
    entity_type = Column(String(50), nullable=False, index=True)  # 'case', 'playbook_rule', etc.
    entity_id = Column(String(50), nullable=False, index=True)
    action = Column(String(50), nullable=False)  # 'CREATE', 'UPDATE', 'DELETE', 'STATE_CHANGE'
    actor_id = Column(String(50), nullable=False)  # user_id
    changes = Column(JSON, nullable=True)  # {old: {field: value}, new: {field: value}}
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    def __repr__(self):
        return f"<AuditLog(entity={self.entity_type}:{self.entity_id}, action={self.action})>"
