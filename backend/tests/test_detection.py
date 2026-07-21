"""
Unit tests for Phase 1 detection engine.

Tests cover:
- EWMA baseline computation
- Z-score anomaly scoring
- Cold-start handling
- Evidence JSON structure
"""

import pytest
import math
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.models import Transaction
from app.detection.baseline import compute_ewma_baseline, get_entity_baseline_stats
from app.detection.scorer import compute_z_score, score_transaction


class TestEWMABaseline:
    """Test exponential moving average baseline computation."""
    
    def test_compute_ewma_baseline_normal_case(self, db: Session):
        """Test EWMA computation with 30+ days of data."""
        card_id = "test_card_001"
        now = datetime.utcnow()
        
        # Create 35 transactions over 35 days, amounts increasing gradually
        for i in range(35):
            tx_date = now - timedelta(days=35 - i)
            amount = 100.0 + (i * 2)  # 100, 102, 104, ..., 170
            
            transaction = Transaction(
                transaction_id=f"tx_{i:05d}",
                card_id=card_id,
                amount=amount,
                timestamp=tx_date,
                label=0
            )
            db.add(transaction)
        
        db.commit()
        
        # Compute baseline
        baseline = compute_ewma_baseline(card_id, db, window_days=30, alpha=0.2)
        
        assert baseline is not None
        assert "mean" in baseline
        assert "stddev" in baseline
        assert "count" in baseline
        assert baseline["count"] >= 25  # At least 25 txs within 30-day window (Kaggle dataset naturally has ~29)
        assert baseline["mean"] > 100  # EWMA should reflect recent higher values
        assert baseline["stddev"] > 0
    
    def test_cold_start_insufficient_history(self, db: Session):
        """Test cold-start behavior: <7 transactions returns None."""
        card_id = "test_card_coldstart"
        now = datetime.utcnow()
        
        # Create only 5 transactions
        for i in range(5):
            tx_date = now - timedelta(days=5 - i)
            transaction = Transaction(
                transaction_id=f"cold_{i:05d}",
                card_id=card_id,
                amount=100.0 + i,
                timestamp=tx_date,
                label=0
            )
            db.add(transaction)
        
        db.commit()
        
        # Should return None (insufficient history < 7 txs)
        baseline = compute_ewma_baseline(card_id, db, window_days=30)
        assert baseline is None
    
    def test_ewma_weights_recent_higher(self, db: Session):
        """Test that EWMA gives more weight to recent transactions."""
        card_id = "test_card_weights"
        now = datetime.utcnow()
        
        # Old: 100, recent: 200
        amounts = [100] * 25 + [200] * 5
        
        for i, amount in enumerate(amounts):
            tx_date = now - timedelta(days=30 - i)
            transaction = Transaction(
                transaction_id=f"weight_{i:05d}",
                card_id=card_id,
                amount=float(amount),
                timestamp=tx_date,
                label=0
            )
            db.add(transaction)
        
        db.commit()
        
        baseline = compute_ewma_baseline(card_id, db, window_days=30, alpha=0.2)
        
        assert baseline is not None
        # EWMA should be closer to 200 (recent) than simple mean (120)
        simple_mean = sum(amounts) / len(amounts)
        assert baseline["mean"] > simple_mean


class TestZScoreScoring:
    """Test z-score anomaly detection."""
    
    def test_normal_transaction_not_anomalous(self):
        """Test that transaction within 3σ is not flagged."""
        baseline_mean = 100.0
        baseline_stddev = 10.0
        amount = 105.0  # 0.5σ from mean
        
        result = compute_z_score(amount, baseline_mean, baseline_stddev, threshold=3.0)
        
        assert result["z_score"] == 0.5
        assert result["is_anomalous"] is False
        assert result["transaction_amount"] == 105.0
        assert result["baseline_mean"] == 100.0
    
    def test_anomalous_transaction_flagged(self):
        """Test that transaction >3σ is flagged as anomalous."""
        baseline_mean = 100.0
        baseline_stddev = 10.0
        amount = 130.1  # 3.01σ from mean → anomalous
        
        result = compute_z_score(amount, baseline_mean, baseline_stddev, threshold=3.0)
        
        assert result["z_score"] > 3.0
        assert result["is_anomalous"] is True
        assert result["deviation"] == pytest.approx(30.1, abs=0.01)
    
    def test_z_score_calculation_accuracy(self):
        """Test z-score calculation: z = (x - μ) / σ."""
        baseline_mean = 50.0
        baseline_stddev = 5.0
        amount = 65.0  # (65 - 50) / 5 = 3.0
        
        result = compute_z_score(amount, baseline_mean, baseline_stddev)
        
        assert result["z_score"] == 3.0
        assert result["deviation"] == 15.0
    
    def test_zero_variance_edge_case(self):
        """Test edge case: all historical amounts identical (stddev=0)."""
        baseline_mean = 100.0
        baseline_stddev = 0.0
        amount = 100.0
        
        result = compute_z_score(amount, baseline_mean, baseline_stddev)
        
        # Same amount → z = 0
        assert result["z_score"] == 0.0
        assert result["is_anomalous"] is False
    
    def test_zero_variance_different_amount(self):
        """Test zero variance with different amount."""
        baseline_mean = 100.0
        baseline_stddev = 0.0
        amount = 150.0
        
        result = compute_z_score(amount, baseline_mean, baseline_stddev)
        
        # Different amount → z = inf (anomalous)
        assert result["z_score"] == float('inf')
        assert result["is_anomalous"] is True
    
    def test_evidence_dict_structure(self):
        """Test that evidence dict contains required fields."""
        result = compute_z_score(120.0, 100.0, 10.0)
        
        evidence = result["evidence_dict"]
        required_fields = [
            "baseline_mean",
            "baseline_stddev",
            "transaction_amount",
            "deviation",
            "z_score",
            "threshold",
            "is_anomalous",
            "calculation"
        ]
        
        for field in required_fields:
            assert field in evidence
    
    def test_custom_threshold(self):
        """Test z-score with custom threshold."""
        result = compute_z_score(
            amount=102.1,
            baseline_mean=100.0,
            baseline_stddev=1.0,
            threshold=2.0  # 2σ threshold instead of 3σ
        )
        
        assert result["z_score"] > 2.0
        assert result["is_anomalous"] is True  # Above threshold


class TestDetectionIntegration:
    """Integration tests combining baseline and scoring."""
    
    def test_full_detection_workflow(self, db: Session):
        """Test complete workflow: create baseline, score transaction."""
        card_id = "test_card_workflow"
        now = datetime.utcnow()
        
        # Create 31 days of transactions
        for i in range(31):
            tx_date = now - timedelta(days=31 - i)
            amount = 100.0 + (i % 5) * 10  # Vary between 100-140
            
            transaction = Transaction(
                transaction_id=f"wf_{i:05d}",
                card_id=card_id,
                amount=amount,
                timestamp=tx_date,
                label=0
            )
            db.add(transaction)
        
        db.commit()
        
        # Get baseline
        baseline = get_entity_baseline_stats(card_id, db, window_days=30)
        assert baseline is not None
        
        # Score a normal transaction
        normal_score = score_transaction(
            amount=120.0,
            baseline_mean=baseline["mean"],
            baseline_stddev=baseline["stddev"]
        )
        assert normal_score["is_anomalous"] is False
        
        # Score an anomalous transaction
        anomalous_score = score_transaction(
            amount=500.0,  # Far outside normal range
            baseline_mean=baseline["mean"],
            baseline_stddev=baseline["stddev"]
        )
        assert anomalous_score["is_anomalous"] is True
    
    def test_multiple_cards_independent_baselines(self, db: Session):
        """Test that each card has independent baseline."""
        now = datetime.utcnow()
        
        # Card 1: low amounts (100-110)
        card1_id = "card_low"
        for i in range(31):
            tx_date = now - timedelta(days=31 - i)
            transaction = Transaction(
                transaction_id=f"low_{i:05d}",
                card_id=card1_id,
                amount=100.0 + (i % 10),
                timestamp=tx_date,
                label=0
            )
            db.add(transaction)
        
        # Card 2: high amounts (1000-1100)
        card2_id = "card_high"
        for i in range(31):
            tx_date = now - timedelta(days=31 - i)
            transaction = Transaction(
                transaction_id=f"high_{i:05d}",
                card_id=card2_id,
                amount=1000.0 + (i % 100),
                timestamp=tx_date,
                label=0
            )
            db.add(transaction)
        
        db.commit()
        
        baseline1 = compute_ewma_baseline(card1_id, db)
        baseline2 = compute_ewma_baseline(card2_id, db)
        
        assert baseline1 is not None
        assert baseline2 is not None
        assert baseline1["mean"] < 200  # Card 1 low
        assert baseline2["mean"] > 900  # Card 2 high


class TestScoreResultStructure:
    """Test ScoreResult TypedDict structure."""
    
    def test_score_result_contains_all_fields(self):
        """Verify ScoreResult has all required fields."""
        result = score_transaction(120.0, 100.0, 10.0)
        
        required_keys = [
            "z_score",
            "baseline_mean",
            "baseline_stddev",
            "transaction_amount",
            "deviation",
            "is_anomalous",
            "threshold",
            "evidence_dict"
        ]
        
        for key in required_keys:
            assert key in result
    
    def test_score_result_types(self):
        """Verify ScoreResult field types."""
        result = score_transaction(120.0, 100.0, 10.0)
        
        assert isinstance(result["z_score"], float)
        assert isinstance(result["baseline_mean"], float)
        assert isinstance(result["baseline_stddev"], float)
        assert isinstance(result["transaction_amount"], float)
        assert isinstance(result["deviation"], float)
        assert isinstance(result["is_anomalous"], bool)
        assert isinstance(result["threshold"], float)
        assert isinstance(result["evidence_dict"], dict)
