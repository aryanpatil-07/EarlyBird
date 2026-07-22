"""
Correlation rules for root cause analysis.

Rules identify related transactions that may explain why an anomaly occurred.
Three rule types: same_entity, same_merchant, amount_pattern.
"""

from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.models import Transaction, Anomaly


class CorrelationRules:
    """Collection of correlation rules for finding related activity."""
    
    @staticmethod
    def same_entity_rule(
        anomaly: Anomaly,
        db: Session,
        window_hours: int = 24
    ) -> list[dict]:
        """
        Find other transactions for the same card within window_hours.
        
        Rule: Same card used multiple times in short window may indicate
        account compromise or heavy usage pattern preceding anomaly.
        
        Args:
            anomaly: Anomaly record
            db: SQLAlchemy session
            window_hours: Lookback window (default 24 hours)
        
        Returns:
            List of dicts: [{"transaction_id": int, "card_id": str, "amount": float, ...}]
        """
        # Get the original transaction
        orig_tx = db.query(Transaction).filter(
            Transaction.id == anomaly.transaction_id
        ).first()
        
        if not orig_tx:
            return []
        
        # Find other transactions for same card in window
        window_start = orig_tx.timestamp - timedelta(hours=window_hours)
        window_end = orig_tx.timestamp + timedelta(hours=window_hours)
        
        related_txs = db.query(Transaction).filter(
            Transaction.card_id == orig_tx.card_id,
            Transaction.timestamp >= window_start,
            Transaction.timestamp <= window_end,
            Transaction.id != orig_tx.id  # Exclude the anomaly tx itself
        ).order_by(Transaction.timestamp).all()
        
        return [
            {
                "transaction_id": tx.id,
                "card_id": tx.card_id,
                "amount": tx.amount,
                "timestamp": tx.timestamp.isoformat(),
                "merchant_id": tx.merchant_id,
            }
            for tx in related_txs
        ]
    
    @staticmethod
    def same_merchant_rule(
        anomaly: Anomaly,
        db: Session,
        window_hours: int = 24
    ) -> list[dict]:
        """
        Find other transactions at the same merchant within window_hours.
        
        Rule: Multiple cards hitting same merchant in short window may indicate
        merchant compromise, data breach, or merchant fraud.
        
        Args:
            anomaly: Anomaly record
            db: SQLAlchemy session
            window_hours: Lookback window (default 24 hours)
        
        Returns:
            List of dicts: [{"transaction_id": int, "card_id": str, ...}]
        """
        # Get the original transaction
        orig_tx = db.query(Transaction).filter(
            Transaction.id == anomaly.transaction_id
        ).first()
        
        if not orig_tx or not orig_tx.merchant_id:
            return []
        
        # Find other transactions at same merchant in window
        window_start = orig_tx.timestamp - timedelta(hours=window_hours)
        window_end = orig_tx.timestamp + timedelta(hours=window_hours)
        
        related_txs = db.query(Transaction).filter(
            Transaction.merchant_id == orig_tx.merchant_id,
            Transaction.timestamp >= window_start,
            Transaction.timestamp <= window_end,
            Transaction.id != orig_tx.id  # Exclude the anomaly tx itself
        ).order_by(Transaction.timestamp).all()
        
        return [
            {
                "transaction_id": tx.id,
                "card_id": tx.card_id,
                "amount": tx.amount,
                "timestamp": tx.timestamp.isoformat(),
                "merchant_id": tx.merchant_id,
            }
            for tx in related_txs
        ]
    
    @staticmethod
    def amount_pattern_rule(
        anomaly: Anomaly,
        db: Session,
        window_hours: int = 24,
        tolerance_percent: float = 10.0
    ) -> list[dict]:
        """
        Find transactions with similar amounts for same card in window.
        
        Rule: Rapid sequence of similar-sized transactions from same card
        may indicate card testing, systematic fraud, or spending pattern shift.
        
        Args:
            anomaly: Anomaly record
            db: SQLAlchemy session
            window_hours: Lookback window (default 24 hours)
            tolerance_percent: Amount tolerance as percentage (default 10%)
        
        Returns:
            List of dicts: [{"transaction_id": int, "amount": float, ...}]
        """
        # Get the original transaction
        orig_tx = db.query(Transaction).filter(
            Transaction.id == anomaly.transaction_id
        ).first()
        
        if not orig_tx:
            return []
        
        # Calculate tolerance range
        lower_bound = orig_tx.amount * (1.0 - tolerance_percent / 100.0)
        upper_bound = orig_tx.amount * (1.0 + tolerance_percent / 100.0)
        
        # Find transactions for same card with similar amounts in window
        window_start = orig_tx.timestamp - timedelta(hours=window_hours)
        window_end = orig_tx.timestamp + timedelta(hours=window_hours)
        
        related_txs = db.query(Transaction).filter(
            Transaction.card_id == orig_tx.card_id,
            Transaction.amount >= lower_bound,
            Transaction.amount <= upper_bound,
            Transaction.timestamp >= window_start,
            Transaction.timestamp <= window_end,
            Transaction.id != orig_tx.id  # Exclude the anomaly tx itself
        ).order_by(Transaction.timestamp).all()
        
        return [
            {
                "transaction_id": tx.id,
                "card_id": tx.card_id,
                "amount": tx.amount,
                "timestamp": tx.timestamp.isoformat(),
                "merchant_id": tx.merchant_id,
            }
            for tx in related_txs
        ]
