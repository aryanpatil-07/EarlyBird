"""
Dashboard metrics computation — M6

Computes six key metrics from case and anomaly data:
- Precision: TP / (TP + FP)
- Recall: TP / (TP + FN)
- RCA Accuracy: manually-verified correlations / total reviewed
- KB Coverage: KB entries / resolved cases
- SLA Compliance: resolved within 2h / total cases
- Dedup Rate: (total anomalies - total cases) / total anomalies

Truth source: transaction.label = 1 (fraud from Kaggle dataset)
"""

from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from typing import Dict, Any


def compute_precision(session: Session) -> float:
    """
    Precision = TP / (TP + FP)
    
    TP: anomalies flagged where transaction.label = 1
    FP: anomalies flagged where transaction.label = 0
    """
    from app.models import Anomaly, Transaction
    
    # Count true positives (flagged and fraud)
    tp = session.query(func.count(Anomaly.id)).join(
        Transaction, Anomaly.transaction_id == Transaction.id
    ).filter(Transaction.label == 1).scalar() or 0
    
    # Count false positives (flagged but legitimate)
    fp = session.query(func.count(Anomaly.id)).join(
        Transaction, Anomaly.transaction_id == Transaction.id
    ).filter(Transaction.label == 0).scalar() or 0
    
    if tp + fp == 0:
        return 0.0
    
    return tp / (tp + fp)


def compute_recall(session: Session) -> float:
    """
    Recall = TP / (TP + FN)
    
    TP: anomalies flagged where transaction.label = 1
    FN: transactions NOT flagged where transaction.label = 1
    """
    from app.models import Anomaly, Transaction
    
    # Count fraudulent transactions that were flagged
    tp = session.query(func.count(Anomaly.id)).join(
        Transaction, Anomaly.transaction_id == Transaction.id
    ).filter(Transaction.label == 1).scalar() or 0
    
    # Count all fraudulent transactions
    total_fraud = session.query(func.count(Transaction.id)).filter(
        Transaction.label == 1
    ).scalar() or 0
    
    if total_fraud == 0:
        return 0.0
    
    fn = total_fraud - tp
    return tp / (tp + fn)


def compute_rca_accuracy(session: Session) -> float:
    """
    RCA Accuracy = meaningful_correlations / total_reviewed_cases
    
    Note: This requires manual marking by analyst in case.recommendations or
    a separate field. For now, return placeholder 0.0 (to be filled by analyst
    in Phase 8 validation).
    
    In production, could compute from:
    - case.recommendations contains explicit analyst-marked RCA feedback
    - or separate rca_assessment table with (case_id, is_meaningful, reviewer_id)
    """
    # Placeholder: 0.0 (to be validated manually in M8)
    return 0.0


def compute_kb_coverage(session: Session) -> float:
    """
    KB Coverage = KB entries / resolved cases
    
    Resolved cases: cases where state = 'RESOLVED'
    KB entries: knowledge_base entries (1:1 with resolved cases if atomicity maintained)
    """
    from app.models import Case, KnowledgeBase
    
    resolved_cases = session.query(func.count(Case.id)).filter(
        Case.state == 'RESOLVED'
    ).scalar() or 0
    
    kb_entries = session.query(func.count(KnowledgeBase.id)).scalar() or 0
    
    if resolved_cases == 0:
        return 0.0
    
    return kb_entries / resolved_cases


def compute_sla_compliance(session: Session) -> float:
    """
    SLA Compliance = resolved_within_2h / total_cases
    
    Resolved within 2h: resolved_at - created_at <= 2 hours
    Total cases: all cases (any state)
    """
    from app.models import Case
    
    total_cases = session.query(func.count(Case.id)).scalar() or 0
    
    if total_cases == 0:
        return 0.0
    
    # Count resolved cases within 2 hours
    two_hours = timedelta(hours=2)
    compliant = session.query(func.count(Case.id)).filter(
        Case.state == 'RESOLVED',
        (Case.resolved_at - Case.created_at) <= two_hours
    ).scalar() or 0
    
    return compliant / total_cases


def compute_dedup_rate(session: Session) -> float:
    """
    Dedup Rate = (total anomalies - total cases) / total anomalies
    
    Higher rate = more de-duplication happening (good!)
    
    Example:
    - 1000 anomalies detected
    - 700 cases created (30% merged)
    - Dedup Rate = (1000 - 700) / 1000 = 0.30 (30%)
    """
    from app.models import Anomaly, Case
    
    total_anomalies = session.query(func.count(Anomaly.id)).scalar() or 0
    total_cases = session.query(func.count(Case.id)).scalar() or 0
    
    if total_anomalies == 0:
        return 0.0
    
    return (total_anomalies - total_cases) / total_anomalies


def get_all_metrics(session: Session) -> Dict[str, Any]:
    """
    Compute and return all six metrics.
    
    Returns:
        {
            "precision": float (0.0-1.0),
            "recall": float (0.0-1.0),
            "rca_accuracy": float (0.0-1.0),
            "kb_coverage": float (0.0-1.0),
            "sla_compliance": float (0.0-1.0),
            "dedup_rate": float (0.0-1.0),
            "computed_at": ISO timestamp
        }
    """
    return {
        "precision": round(compute_precision(session), 4),
        "recall": round(compute_recall(session), 4),
        "rca_accuracy": round(compute_rca_accuracy(session), 4),
        "kb_coverage": round(compute_kb_coverage(session), 4),
        "sla_compliance": round(compute_sla_compliance(session), 4),
        "dedup_rate": round(compute_dedup_rate(session), 4),
        "computed_at": datetime.utcnow().isoformat() + "Z"
    }
