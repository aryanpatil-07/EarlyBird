"""
Root cause domain service — Correlate flagged anomalies with surrounding account activity and merchant context.
"""

from datetime import datetime, timedelta
from typing import List
from sqlalchemy.orm import Session
from app.models import Anomaly, RootCauseLink, Transaction


def correlate_root_causes(
    db: Session,
    anomaly_id: int,
    card_id: str,
    anomaly_time: datetime,
    window_hours: int = 24
) -> List[RootCauseLink]:
    """
    Find context transactions for card_id within window_hours of anomaly_time.
    Creates RootCauseLink entries idempotently.
    """
    start_window = anomaly_time - timedelta(hours=window_hours)
    
    # Find recent transactions on same card
    recent_txs = (
        db.query(Transaction)
        .filter(
            Transaction.card_id == card_id,
            Transaction.timestamp >= start_window,
            Transaction.timestamp <= anomaly_time + timedelta(hours=1)
        )
        .order_by(Transaction.timestamp.desc())
        .limit(10)
        .all()
    )

    created_links = []

    for tx in recent_txs:
        # Avoid linking to self if transaction_id matches
        anomaly = db.query(Anomaly).filter(Anomaly.id == anomaly_id).first()
        if anomaly and anomaly.transaction_id == tx.id:
            continue

        # Check existing link to prevent duplicates
        existing = db.query(RootCauseLink).filter(
            RootCauseLink.anomaly_id == anomaly_id,
            RootCauseLink.related_transaction_id == tx.transaction_id
        ).first()

        if existing:
            continue

        # Determine link type & correlation strength
        if tx.amount > 500:
            link_type = "high_amount"
            strength = 0.9
            explanation = f"Prior high-amount transaction of ${tx.amount:.2f} at {tx.merchant_id or 'unknown merchant'}."
        elif tx.merchant_id and anomaly and tx.merchant_id != getattr(anomaly, 'merchant_id', None):
            link_type = "merchant_switch"
            strength = 0.75
            explanation = f"Recent transaction at distinct merchant {tx.merchant_id}."
        else:
            link_type = "same_entity"
            strength = 0.6
            explanation = f"Prior transaction of ${tx.amount:.2f} recorded for card {card_id}."

        link = RootCauseLink(
            anomaly_id=anomaly_id,
            related_transaction_id=tx.transaction_id,
            link_type=link_type,
            correlation_strength=strength,
            explanation=explanation,
            evidence={
                "amount": tx.amount,
                "merchant_id": tx.merchant_id,
                "timestamp": tx.timestamp.isoformat()
            },
            created_at=datetime.utcnow()
        )
        db.add(link)
        created_links.append(link)

    db.commit()
    return created_links


def run_correlation_cycle(db: Session) -> dict:
    """Run correlation cycle across all anomalies."""
    anomalies = db.query(Anomaly).all()
    links_created = 0
    for anomaly in anomalies:
        tx = db.query(Transaction).filter(Transaction.id == anomaly.transaction_id).first()
        card_id = tx.card_id if tx else (anomaly.entity_id or "unknown")
        anomaly_time = tx.timestamp if tx else anomaly.created_at
        created = correlate_root_causes(db, anomaly.id, card_id, anomaly_time)
        links_created += len(created)
    return {"anomalies_evaluated": len(anomalies), "links_created": links_created}
