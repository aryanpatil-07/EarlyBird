"""
Detection domain service — Idempotent detection engine processing transactions into anomalies and cases.
"""

from typing import List
from sqlalchemy.orm import Session
from app.models import Transaction, Anomaly, Case
from app.detection.baseline import compute_ewma_baseline
from app.detection.scorer import score_transaction
from app.cases.service import create_or_dedup_case
from app.root_cause.service import correlate_root_causes


def run_detection_cycle(db: Session, z_threshold: float = 3.0, limit: int = 500) -> dict:
    """
    Run an idempotent anomaly detection cycle.
    
    1. Scan transactions.
    2. Skip transactions that ALREADY have an Anomaly record (guarantees idempotency).
    3. Compute EWMA baseline per card_id.
    4. Score deviation via z-score.
    5. If anomalous (or flagged in Kaggle dataset), create Anomaly record.
    6. Run root cause correlation.
    7. Create or merge Case.
    """
    txs = (
        db.query(Transaction)
        .order_by(Transaction.timestamp.desc())
        .limit(limit)
        .all()
    )

    created_anomalies = []
    created_cases = []
    skipped_count = 0

    for tx in txs:
        # Check if transaction already has an anomaly recorded
        existing_anomaly = db.query(Anomaly).filter(Anomaly.transaction_id == tx.id).first()
        if existing_anomaly:
            skipped_count += 1
            continue

        # Check baseline for card
        baseline_stats = compute_ewma_baseline(tx.card_id, db)
        
        # Cold start fallback if insufficient history
        if not baseline_stats:
            baseline_mean = tx.amount * 0.5 if tx.amount > 0 else 100.0
            baseline_stddev = max(baseline_mean * 0.2, 10.0)
        else:
            baseline_mean = baseline_stats["mean"]
            baseline_stddev = max(baseline_stats["stddev"], 1.0)

        score_res = score_transaction(tx.amount, baseline_mean, baseline_stddev, threshold=z_threshold)
        
        # Flag if z-score > threshold OR labeled fraud in dataset
        is_fraud = tx.label == 1
        is_anomalous = score_res["is_anomalous"] or is_fraud

        if is_anomalous:
            severity = "HIGH" if (score_res["z_score"] > 5.0 or is_fraud) else ("MEDIUM" if score_res["z_score"] > 3.0 else "LOW")
            
            anomaly = Anomaly(
                transaction_id=tx.id,
                entity_id=tx.card_id,
                metric="amount",
                severity=severity,
                score=round(score_res["z_score"], 2) if not float('inf') == score_res["z_score"] else 99.0,
                baseline=round(baseline_mean, 2),
                deviation=round(score_res["deviation"], 2),
                observed_value=round(tx.amount, 2),
                evidence=score_res["evidence_dict"],
                created_at=tx.timestamp
            )
            db.add(anomaly)
            db.flush()
            created_anomalies.append(anomaly)

            # Correlate root causes
            correlate_root_causes(db, anomaly.id, tx.card_id, tx.timestamp)

            # Create or dedup case
            case = create_or_dedup_case(
                db=db,
                anomaly_id=anomaly.id,
                entity_id=tx.card_id,
                severity=severity,
                metric="amount"
            )
            created_cases.append(case)

    db.commit()

    return {
        "success": True,
        "processed_transactions": len(txs),
        "skipped_already_processed": skipped_count,
        "anomalies_detected": len(created_anomalies),
        "cases_created_or_merged": len(created_cases)
    }
