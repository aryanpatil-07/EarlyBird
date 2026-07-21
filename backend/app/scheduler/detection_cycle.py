"""
Detection cycle: background job running every 5 minutes.

Queries unscored transactions, computes baseline + z-score, inserts anomalies.
Runs independently via APScheduler.
"""

from datetime import datetime
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models import Transaction, Anomaly
from app.detection.baseline import compute_ewma_baseline
from app.detection.scorer import compute_z_score


def run_detection_cycle() -> dict:
    """
    Run one detection cycle: score all unscored transactions.
    
    Returns:
        {
            "success": bool,
            "unscored_count": int,
            "scored_count": int,
            "anomalies_created": int,
            "timestamp": str (ISO format),
            "error": str (if failed)
        }
    """
    db = SessionLocal()
    result = {
        "success": False,
        "unscored_count": 0,
        "scored_count": 0,
        "anomalies_created": 0,
        "timestamp": datetime.utcnow().isoformat(),
        "error": None,
    }
    
    try:
        # Query unscored transactions (no anomaly record yet)
        unscored = db.query(Transaction).filter(
            Transaction.anomalies == None
        ).all()
        
        result["unscored_count"] = len(unscored)
        
        if len(unscored) == 0:
            result["success"] = True
            result["scored_count"] = 0
            return result
        
        # Process in batches
        batch_size = 100
        for i in range(0, len(unscored), batch_size):
            batch = unscored[i : i + batch_size]
            
            for tx in batch:
                # Get baseline for this card
                baseline = compute_ewma_baseline(tx.card_id, db)
                
                if baseline is None:
                    # Cold-start: skip this transaction
                    continue
                
                # Compute z-score
                score_result = compute_z_score(
                    amount=tx.amount,
                    baseline_mean=baseline["mean"],
                    baseline_stddev=baseline["stddev"],
                    threshold=3.0
                )
                
                result["scored_count"] += 1
                
                # Insert anomaly if anomalous
                if score_result["is_anomalous"]:
                    anomaly = Anomaly(
                        transaction_id=tx.id,
                        score=score_result["z_score"],
                        baseline=baseline["mean"],
                        deviation=score_result["deviation"],
                        evidence=score_result["evidence_dict"],
                    )
                    db.add(anomaly)
                    result["anomalies_created"] += 1
            
            # Commit batch
            db.commit()
        
        result["success"] = True
        return result
    
    except Exception as e:
        result["success"] = False
        result["error"] = str(e)
        db.rollback()
        return result
    
    finally:
        db.close()


def detection_cycle_callback():
    """
    APScheduler callback: run detection cycle and log result.
    """
    result = run_detection_cycle()
    
    if result["success"]:
        print(
            f"[{result['timestamp']}] Detection cycle complete. "
            f"Unscored: {result['unscored_count']}, "
            f"Scored: {result['scored_count']}, "
            f"Anomalies: {result['anomalies_created']}"
        )
    else:
        print(
            f"[{result['timestamp']}] Detection cycle FAILED: {result['error']}"
        )
