"""
Dashboard domain service — Compute real PRD metrics from stored database facts.
"""

from datetime import datetime, timedelta
from typing import Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models import Case, Anomaly, KnowledgeBase, Transaction


def compute_mttd_seconds(session: Session) -> float:
    """
    Mean Time to Detect (MTTD): average difference in seconds between transaction timestamp and anomaly created_at.
    """
    results = session.query(
        Anomaly.created_at, Transaction.timestamp
    ).join(Transaction, Anomaly.transaction_id == Transaction.id).all()

    if not results:
        return 0.0

    diffs = [(a_time - t_time).total_seconds() for a_time, t_time in results if a_time >= t_time]
    return sum(diffs) / len(diffs) if diffs else 0.0


def compute_mttr_seconds(session: Session) -> float:
    """
    Mean Time to Resolve (MTTR): average difference in seconds between case created_at and resolved_at for RESOLVED cases.
    """
    resolved_cases = session.query(Case).filter(Case.state == "RESOLVED", Case.resolved_at.isnot(None)).all()
    if not resolved_cases:
        return 0.0

    diffs = [(c.resolved_at - c.created_at).total_seconds() for c in resolved_cases if c.resolved_at >= c.created_at]
    return sum(diffs) / len(diffs) if diffs else 0.0


def compute_dedup_rate(session: Session) -> float:
    """
    De-duplication Rate: (total_anomalies - total_cases) / total_anomalies
    """
    anomalies_count = session.query(func.count(Anomaly.id)).scalar() or 0
    cases_count = session.query(func.count(Case.id)).scalar() or 0
    if anomalies_count == 0:
        return 0.0
    return max(0.0, (anomalies_count - cases_count) / float(anomalies_count))


def compute_sla_acknowledgement_rate(session: Session) -> float:
    """
    SLA Acknowledgement Rate: % of cases acknowledged or resolved before sla_deadline.
    """
    total = session.query(func.count(Case.id)).scalar() or 0
    if total == 0:
        return 1.0

    acked = session.query(func.count(Case.id)).filter(
        Case.state.in_(["ACKNOWLEDGED", "ACCEPTED", "RESOLVED", "ESCALATED"]),
        (Case.updated_at <= Case.sla_deadline) | (Case.sla_deadline.is_(None))
    ).scalar() or 0

    return acked / float(total)


def compute_documentation_coverage(session: Session) -> float:
    """
    Documentation Coverage: % of resolved cases that have a Knowledge Base record.
    """
    resolved_count = session.query(func.count(Case.id)).filter(Case.state == "RESOLVED").scalar() or 0
    if resolved_count == 0:
        return 1.0

    kb_count = session.query(func.count(KnowledgeBase.id)).scalar() or 0
    return min(1.0, kb_count / float(resolved_count))


def get_dashboard_metrics(session: Session) -> Dict[str, Any]:
    """
    Compute canonical PRD metrics.
    """
    mttd = compute_mttd_seconds(session)
    mttr = compute_mttr_seconds(session)
    dedup = compute_dedup_rate(session)
    sla_ack = compute_sla_acknowledgement_rate(session)
    doc_cov = compute_documentation_coverage(session)

    return {
        "mttdSeconds": round(mttd, 1),
        "mttrSeconds": round(mttr, 1),
        "deduplicationRate": round(dedup, 4),
        "slaAcknowledgementRate": round(sla_ack, 4),
        "documentationCoverage": round(doc_cov, 4),
        "computedAt": datetime.utcnow().isoformat() + "Z"
    }
