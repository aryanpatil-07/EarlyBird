"""
Alert De-duplication Logic — Find and group near-duplicate anomalies into single cases.

Implements FR-020 (Dedup requirement) per LLD §3.
"""

from datetime import datetime, timedelta
from typing import Optional, List, Tuple
from sqlalchemy.orm import Session


def find_mergeable_case(
    session: Session,
    anomaly_entity_id: int,
    anomaly_metric_name: str,
    window_minutes: int = 30
) -> Optional[int]:
    """
    Check if an anomaly should be merged into an existing OPEN case.
    
    A new anomaly is a near-duplicate of an existing OPEN case if:
    - Same entity_id (card, merchant, etc.)
    - Same metric_name (amount, transaction_count, etc.)
    - Within `window_minutes` of the case's most recent anomaly
    
    This is intentionally simple (no fuzzy matching) — simple, explainable
    de-dup rules beat a clever similarity score nobody could explain.
    
    Args:
        session: SQLAlchemy session
        anomaly_entity_id: The entity ID of the anomaly
        anomaly_metric_name: The metric name (e.g., 'amount', 'tx_count')
        window_minutes: Time window for de-dup (default 30 minutes)
        
    Returns:
        case_id (int) if a mergeable case exists, None otherwise
    """
    from app.models import Case, Anomaly, Transaction
    from sqlalchemy import and_, or_
    
    cutoff_time = datetime.utcnow() - timedelta(minutes=window_minutes)
    
    # Query for an OPEN case that matches entity and metric
    # and has at least one anomaly created within the window
    candidate_case = (
        session.query(Case.id)
        .join(Anomaly, Case.id == Anomaly.case_id, isouter=True)
        .join(Transaction, Anomaly.transaction_id == Transaction.id, isouter=True)
        .filter(
            and_(
                Case.state.in_(["NEW", "ACCEPTED"]),
                Transaction.card_id == anomaly_entity_id,  # Assuming entity_id maps to card_id
                Anomaly.created_at >= cutoff_time,
            )
        )
        .order_by(Anomaly.created_at.desc())
        .first()
    )
    
    if candidate_case:
        return candidate_case[0]
    return None


def group_anomalies_for_dedup(
    session: Session,
    anomaly_ids: List[int],
    window_minutes: int = 24 * 60  # 24-hour default window
) -> List[List[int]]:
    """
    Group anomalies into de-duplicate clusters.
    
    Anomalies are grouped if they share:
    - Same entity (card_id)
    - Within `window_minutes` of each other
    
    Args:
        session: SQLAlchemy session
        anomaly_ids: List of anomaly IDs to group
        window_minutes: Time window for grouping
        
    Returns:
        List of groups, each group is a list of anomaly IDs that should be merged
    """
    from app.models import Anomaly, Transaction
    
    if not anomaly_ids:
        return []
    
    # Fetch anomalies with their transaction info
    anomalies = (
        session.query(Anomaly.id, Transaction.card_id, Anomaly.created_at)
        .join(Transaction, Anomaly.transaction_id == Transaction.id)
        .filter(Anomaly.id.in_(anomaly_ids))
        .all()
    )
    
    if not anomalies:
        return []
    
    # Sort by creation time
    anomalies_sorted = sorted(anomalies, key=lambda x: x[2])
    
    groups: List[List[int]] = []
    current_group: List[int] = []
    current_entity_id = None
    current_time = None
    cutoff = timedelta(minutes=window_minutes)
    
    for anomaly_id, entity_id, created_at in anomalies_sorted:
        if (
            current_entity_id is None  # First anomaly
            or (entity_id == current_entity_id and created_at - current_time <= cutoff)
        ):
            # Add to current group
            current_group.append(anomaly_id)
            current_entity_id = entity_id
            current_time = created_at
        else:
            # Start a new group
            if current_group:
                groups.append(current_group)
            current_group = [anomaly_id]
            current_entity_id = entity_id
            current_time = created_at
    
    # Add the last group
    if current_group:
        groups.append(current_group)
    
    return groups


def calculate_dedup_stats(
    session: Session,
    total_anomalies: int,
    total_cases: int
) -> dict:
    """
    Calculate de-duplication statistics for the dashboard.
    
    Args:
        session: SQLAlchemy session
        total_anomalies: Total count of anomalies processed
        total_cases: Total count of cases created
        
    Returns:
        Dictionary with dedup_rate (percentage) and merged_count
    """
    if total_anomalies == 0:
        return {"dedup_rate": 0.0, "merged_count": 0}
    
    merged_count = total_anomalies - total_cases
    dedup_rate = (merged_count / total_anomalies) * 100
    
    return {
        "dedup_rate": dedup_rate,
        "merged_count": merged_count,
        "total_anomalies": total_anomalies,
        "total_cases": total_cases,
    }
