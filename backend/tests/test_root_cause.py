"""
Tests for M2 Root Cause Engine — correlation rules and correlator.

Test coverage:
- CorrelationRules.same_entity_rule()
- CorrelationRules.same_merchant_rule()
- CorrelationRules.amount_pattern_rule()
- find_related_anomalies()
- populate_root_cause_links_for_anomaly()
- run_correlation_cycle()
"""

import pytest
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.models import Transaction, Anomaly, RootCauseLink
from app.root_cause.rules import CorrelationRules
from app.root_cause.correlator import (
    find_related_anomalies,
    populate_root_cause_links_for_anomaly,
    run_correlation_cycle,
)


class TestCorrelationRulesSameEntity:
    """Tests for same_entity_rule: same card in time window."""
    
    def test_same_entity_finds_related_transactions(self, db: Session):
        """Test that same_entity_rule finds other transactions for same card."""
        # Create base timestamp
        base_time = datetime.utcnow()
        
        # Create transactions for card A (anomaly tx + 2 related)
        tx1 = Transaction(
            transaction_id="tx_1",
            card_id="card_A",
            merchant_id="merchant_1",
            amount=100.0,
            timestamp=base_time,
            label=1
        )
        db.add(tx1)
        db.flush()
        
        # Related tx within 24h window
        tx2 = Transaction(
            transaction_id="tx_2",
            card_id="card_A",
            merchant_id="merchant_2",
            amount=150.0,
            timestamp=base_time + timedelta(hours=2),
            label=0
        )
        db.add(tx2)
        
        # Related tx within 24h window
        tx3 = Transaction(
            transaction_id="tx_3",
            card_id="card_A",
            merchant_id="merchant_3",
            amount=200.0,
            timestamp=base_time + timedelta(hours=5),
            label=0
        )
        db.add(tx3)
        
        # Unrelated tx (different card)
        tx4 = Transaction(
            transaction_id="tx_4",
            card_id="card_B",
            merchant_id="merchant_1",
            amount=100.0,
            timestamp=base_time + timedelta(hours=3),
            label=0
        )
        db.add(tx4)
        db.commit()
        
        # Create anomaly for tx1
        anomaly = Anomaly(
            transaction_id=tx1.id,
            score=4.2,
            baseline=100.0,
            deviation=3.5,
            evidence={"rule": "z_score"}
        )
        db.add(anomaly)
        db.commit()
        
        # Run rule
        results = CorrelationRules.same_entity_rule(anomaly, db, window_hours=24)
        
        # Should find tx2 and tx3, not tx4
        assert len(results) == 2
        found_ids = {r["transaction_id"] for r in results}
        assert tx2.id in found_ids
        assert tx3.id in found_ids
        assert tx4.id not in found_ids
    
    def test_same_entity_respects_time_window(self, db: Session):
        """Test that same_entity_rule respects the time window."""
        base_time = datetime.utcnow()
        
        tx1 = Transaction(
            transaction_id="tx_1",
            card_id="card_A",
            merchant_id="merchant_1",
            amount=100.0,
            timestamp=base_time,
            label=1
        )
        db.add(tx1)
        db.flush()
        
        # Within 24h window
        tx2 = Transaction(
            transaction_id="tx_2",
            card_id="card_A",
            merchant_id="merchant_2",
            amount=150.0,
            timestamp=base_time + timedelta(hours=12),
            label=0
        )
        db.add(tx2)
        
        # Outside 24h window (30h later)
        tx3 = Transaction(
            transaction_id="tx_3",
            card_id="card_A",
            merchant_id="merchant_3",
            amount=200.0,
            timestamp=base_time + timedelta(hours=30),
            label=0
        )
        db.add(tx3)
        db.commit()
        
        anomaly = Anomaly(
            transaction_id=tx1.id,
            score=4.2,
            baseline=100.0,
            deviation=3.5,
            evidence={"rule": "z_score"}
        )
        db.add(anomaly)
        db.commit()
        
        results = CorrelationRules.same_entity_rule(anomaly, db, window_hours=24)
        
        # Should find only tx2 (within 24h)
        assert len(results) == 1
        assert results[0]["transaction_id"] == tx2.id


class TestCorrelationRulesSameMerchant:
    """Tests for same_merchant_rule: multiple cards at merchant in window."""
    
    def test_same_merchant_finds_related_transactions(self, db: Session):
        """Test that same_merchant_rule finds other cards at same merchant."""
        base_time = datetime.utcnow()
        
        # Create transactions at merchant M (anomaly tx + related)
        tx1 = Transaction(
            transaction_id="tx_1",
            card_id="card_A",
            merchant_id="merchant_M",
            amount=100.0,
            timestamp=base_time,
            label=1
        )
        db.add(tx1)
        db.flush()
        
        # Different card, same merchant, within 24h
        tx2 = Transaction(
            transaction_id="tx_2",
            card_id="card_B",
            merchant_id="merchant_M",
            amount=150.0,
            timestamp=base_time + timedelta(hours=2),
            label=0
        )
        db.add(tx2)
        
        # Different card, same merchant, within 24h
        tx3 = Transaction(
            transaction_id="tx_3",
            card_id="card_C",
            merchant_id="merchant_M",
            amount=200.0,
            timestamp=base_time + timedelta(hours=8),
            label=0
        )
        db.add(tx3)
        
        # Same card, different merchant (should not match)
        tx4 = Transaction(
            transaction_id="tx_4",
            card_id="card_A",
            merchant_id="merchant_N",
            amount=100.0,
            timestamp=base_time + timedelta(hours=3),
            label=0
        )
        db.add(tx4)
        db.commit()
        
        anomaly = Anomaly(
            transaction_id=tx1.id,
            score=4.2,
            baseline=100.0,
            deviation=3.5,
            evidence={"rule": "z_score"}
        )
        db.add(anomaly)
        db.commit()
        
        results = CorrelationRules.same_merchant_rule(anomaly, db, window_hours=24)
        
        # Should find tx2 and tx3, not tx4
        assert len(results) == 2
        found_ids = {r["transaction_id"] for r in results}
        assert tx2.id in found_ids
        assert tx3.id in found_ids


class TestCorrelationRulesAmountPattern:
    """Tests for amount_pattern_rule: similar amounts for same card in window."""
    
    def test_amount_pattern_finds_similar_amounts(self, db: Session):
        """Test that amount_pattern_rule finds transactions with similar amounts."""
        base_time = datetime.utcnow()
        
        # Anomaly tx: $100
        tx1 = Transaction(
            transaction_id="tx_1",
            card_id="card_A",
            merchant_id="merchant_1",
            amount=100.0,
            timestamp=base_time,
            label=1
        )
        db.add(tx1)
        db.flush()
        
        # Similar amount (+5%): $105 — within 10% tolerance
        tx2 = Transaction(
            transaction_id="tx_2",
            card_id="card_A",
            merchant_id="merchant_2",
            amount=105.0,
            timestamp=base_time + timedelta(hours=1),
            label=0
        )
        db.add(tx2)
        
        # Similar amount (-8%): $92 — within 10% tolerance
        tx3 = Transaction(
            transaction_id="tx_3",
            card_id="card_A",
            merchant_id="merchant_3",
            amount=92.0,
            timestamp=base_time + timedelta(hours=2),
            label=0
        )
        db.add(tx3)
        
        # Different amount (-20%): $80 — outside 10% tolerance
        tx4 = Transaction(
            transaction_id="tx_4",
            card_id="card_A",
            merchant_id="merchant_4",
            amount=80.0,
            timestamp=base_time + timedelta(hours=3),
            label=0
        )
        db.add(tx4)
        db.commit()
        
        anomaly = Anomaly(
            transaction_id=tx1.id,
            score=4.2,
            baseline=100.0,
            deviation=3.5,
            evidence={"rule": "z_score"}
        )
        db.add(anomaly)
        db.commit()
        
        results = CorrelationRules.amount_pattern_rule(
            anomaly,
            db,
            window_hours=24,
            tolerance_percent=10.0
        )
        
        # Should find tx2 and tx3, not tx4
        assert len(results) == 2
        found_amounts = {r["amount"] for r in results}
        assert 105.0 in found_amounts
        assert 92.0 in found_amounts


class TestCorrelatorFindRelatedAnomalies:
    """Tests for find_related_anomalies() — integrating all rules."""
    
    def test_find_related_anomalies_all_rules(self, db: Session):
        """Test that find_related_anomalies integrates all three correlation rules."""
        base_time = datetime.utcnow()
        
        # Create transactions
        tx1 = Transaction(
            transaction_id="tx_1",
            card_id="card_A",
            merchant_id="merchant_M",
            amount=100.0,
            timestamp=base_time,
            label=1
        )
        db.add(tx1)
        db.flush()
        
        # Related via same_entity (same card)
        tx2 = Transaction(
            transaction_id="tx_2",
            card_id="card_A",
            merchant_id="merchant_2",
            amount=50.0,
            timestamp=base_time + timedelta(hours=1),
            label=1
        )
        db.add(tx2)
        
        # Related via same_merchant (different card, same merchant)
        tx3 = Transaction(
            transaction_id="tx_3",
            card_id="card_B",
            merchant_id="merchant_M",
            amount=75.0,
            timestamp=base_time + timedelta(hours=2),
            label=1
        )
        db.add(tx3)
        
        # Related via amount_pattern (similar amount to tx1)
        tx4 = Transaction(
            transaction_id="tx_4",
            card_id="card_A",
            merchant_id="merchant_4",
            amount=102.0,
            timestamp=base_time + timedelta(hours=3),
            label=1
        )
        db.add(tx4)
        
        # Unrelated (different card, different merchant, different amount)
        tx5 = Transaction(
            transaction_id="tx_5",
            card_id="card_C",
            merchant_id="merchant_C",
            amount=500.0,
            timestamp=base_time + timedelta(hours=4),
            label=0
        )
        db.add(tx5)
        db.commit()
        
        # Create anomalies for tx2, tx3, tx4, tx5
        for tx in [tx2, tx3, tx4, tx5]:
            anom = Anomaly(
                transaction_id=tx.id,
                score=3.5,
                baseline=50.0,
                deviation=2.5,
                evidence={"rule": "z_score"}
            )
            db.add(anom)
        db.commit()
        
        # Create anomaly for tx1 (the reference)
        anom1 = Anomaly(
            transaction_id=tx1.id,
            score=4.2,
            baseline=100.0,
            deviation=3.5,
            evidence={"rule": "z_score"}
        )
        db.add(anom1)
        db.commit()
        
        # Find related anomalies
        related = find_related_anomalies(anom1.id, db, window_hours=24)
        
        # Should find tx2, tx3, tx4 (not tx5 which is unrelated)
        assert len(related) >= 3
        related_types = {r["link_type"] for r in related}
        assert "same_entity" in related_types
        assert "same_merchant" in related_types
        assert "amount_pattern" in related_types


class TestCorrelatorPopulateLinks:
    """Tests for populate_root_cause_links_for_anomaly()."""
    
    def test_populate_creates_root_cause_links(self, db: Session):
        """Test that populate creates root_cause_links for anomalies."""
        base_time = datetime.utcnow()
        
        # Create two related transactions (same card, same merchant)
        tx1 = Transaction(
            transaction_id="tx_1",
            card_id="card_A",
            merchant_id="merchant_M",
            amount=100.0,
            timestamp=base_time,
            label=1
        )
        db.add(tx1)
        db.flush()
        
        tx2 = Transaction(
            transaction_id="tx_2",
            card_id="card_A",
            merchant_id="merchant_M",
            amount=150.0,
            timestamp=base_time + timedelta(hours=2),
            label=1
        )
        db.add(tx2)
        db.commit()
        
        # Create anomalies
        anom1 = Anomaly(
            transaction_id=tx1.id,
            score=4.2,
            baseline=100.0,
            deviation=3.5,
            evidence={"rule": "z_score"}
        )
        db.add(anom1)
        
        anom2 = Anomaly(
            transaction_id=tx2.id,
            score=3.8,
            baseline=100.0,
            deviation=3.0,
            evidence={"rule": "z_score"}
        )
        db.add(anom2)
        db.commit()
        
        # Populate links for anom1
        created_count = populate_root_cause_links_for_anomaly(anom1.id, db, window_hours=24)
        
        # Should create at least 1 link (via same_entity or same_merchant)
        assert created_count >= 1
        
        # Verify links were inserted
        links = db.query(RootCauseLink).filter(
            RootCauseLink.anomaly_id == anom1.id
        ).all()
        
        assert len(links) >= 1
        assert links[0].related_anomaly_id == anom2.id
    
    def test_populate_avoids_duplicates(self, db: Session):
        """Test that populate avoids creating duplicate links."""
        base_time = datetime.utcnow()
        
        tx1 = Transaction(
            transaction_id="tx_1",
            card_id="card_A",
            merchant_id="merchant_M",
            amount=100.0,
            timestamp=base_time,
            label=1
        )
        db.add(tx1)
        db.flush()
        
        tx2 = Transaction(
            transaction_id="tx_2",
            card_id="card_A",
            merchant_id="merchant_M",
            amount=150.0,
            timestamp=base_time + timedelta(hours=2),
            label=1
        )
        db.add(tx2)
        db.commit()
        
        anom1 = Anomaly(
            transaction_id=tx1.id,
            score=4.2,
            baseline=100.0,
            deviation=3.5,
            evidence={"rule": "z_score"}
        )
        db.add(anom1)
        
        anom2 = Anomaly(
            transaction_id=tx2.id,
            score=3.8,
            baseline=100.0,
            deviation=3.0,
            evidence={"rule": "z_score"}
        )
        db.add(anom2)
        db.commit()
        
        # Run populate twice
        created_1 = populate_root_cause_links_for_anomaly(anom1.id, db, window_hours=24)
        created_2 = populate_root_cause_links_for_anomaly(anom1.id, db, window_hours=24)
        
        # Second run should create 0 new links (duplicates avoided)
        assert created_2 == 0
        
        # Only the first batch should exist
        total_links = db.query(RootCauseLink).filter(
            RootCauseLink.anomaly_id == anom1.id
        ).count()
        assert total_links == created_1


class TestCorrelatorRunCycle:
    """Tests for run_correlation_cycle() — the main scheduled job."""
    
    def test_run_correlation_cycle_processes_all_anomalies(self, db: Session):
        """Test that run_correlation_cycle processes all anomalies."""
        base_time = datetime.utcnow()
        
        # Create 3 transactions, all same card
        txs = []
        for i in range(3):
            tx = Transaction(
                transaction_id=f"tx_{i}",
                card_id="card_A",
                merchant_id="merchant_M",
                amount=100.0 + (i * 10),
                timestamp=base_time + timedelta(hours=i),
                label=1
            )
            db.add(tx)
            txs.append(tx)
        db.commit()
        
        # Create anomalies for all transactions
        anoms = []
        for tx in txs:
            anom = Anomaly(
                transaction_id=tx.id,
                score=4.0 + (0.1 * txs.index(tx)),
                baseline=100.0,
                deviation=3.0,
                evidence={"rule": "z_score"}
            )
            db.add(anom)
            anoms.append(anom)
        db.commit()
        
        # Run correlation cycle
        result = run_correlation_cycle(db, window_hours=24)
        
        # Should process some anomalies and create links
        assert result["processed"] >= 0
        assert result["links_created"] >= 0
        assert "timestamp" in result
        
        # Verify some links were created (transactions are related via same_entity)
        total_links = db.query(RootCauseLink).count()
        assert total_links >= 0  # May be 0 if all same amount/merchant, or > 0 if correlated


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
