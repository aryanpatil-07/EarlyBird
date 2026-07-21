"""
Rolling baseline computation using exponential moving average (EWMA).

Computes per-entity (card_id) baseline to establish "normal" transaction amounts.
Uses EWMA to weight recent history more heavily than old patterns.
"""

import math
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.models import Transaction


def compute_ewma_baseline(
    card_id: str,
    db: Session,
    window_days: int = 30,
    alpha: float = 0.2
) -> dict | None:
    """
    Compute exponential moving average baseline for a card.
    
    Args:
        card_id: Card identifier from transactions table
        db: SQLAlchemy session
        window_days: Historical window (default 30 days)
        alpha: Smoothing factor 0.0-1.0 (default 0.2, so 80% weight to recent)
    
    Returns:
        {
            "mean": float (EWMA baseline amount),
            "stddev": float (standard deviation of amounts),
            "count": int (number of transactions in window)
        }
        Or None if fewer than window_days transactions
    """
    
    # Query all transactions for this card within the window
    cutoff_date = datetime.utcnow() - timedelta(days=window_days)
    
    tx_history = db.query(Transaction).filter(
        Transaction.card_id == card_id,
        Transaction.timestamp >= cutoff_date
    ).order_by(Transaction.timestamp).all()
    
    # Cold-start: need minimum history
    # In practice, check if we have enough data points (not necessarily full window_days)
    min_transactions = 7  # At least 7 days of data
    if len(tx_history) < min_transactions:
        return None
    
    # Compute EWMA
    baseline_value = 0.0
    for i, tx in enumerate(tx_history):
        baseline_value = alpha * tx.amount + (1 - alpha) * baseline_value
    
    # Compute mean and standard deviation
    amounts = [tx.amount for tx in tx_history]
    mean = sum(amounts) / len(amounts)
    
    variance = sum((x - mean) ** 2 for x in amounts) / len(amounts)
    stddev = math.sqrt(variance)
    
    return {
        "mean": baseline_value,
        "stddev": stddev,
        "count": len(tx_history),
    }


def get_entity_baseline_stats(
    card_id: str,
    db: Session,
    window_days: int = 30
) -> dict | None:
    """
    Wrapper to compute baseline. Returns full stats or None if cold-start.
    
    Args:
        card_id: Card identifier
        db: SQLAlchemy session
        window_days: Historical window
    
    Returns:
        Baseline stats dict or None
    """
    return compute_ewma_baseline(card_id, db, window_days=window_days, alpha=0.2)
