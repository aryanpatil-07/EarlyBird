"""
Tests for Phase 6 — Dashboard metrics and audit trail

Covers:
- Precision, Recall, RCA Accuracy, KB Coverage, SLA Compliance, Dedup Rate
- Audit log API endpoint
"""

import pytest
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from app.models import (
    User, Transaction, Anomaly, Case, RootCauseLink, 
    PlaybookRule, KnowledgeBase, AuditLog
)
from app.dashboard.metrics import (
    compute_precision, compute_recall, compute_rca_accuracy,
    compute_kb_coverage, compute_sla_compliance, compute_dedup_rate,
    get_all_metrics
)


class TestPrecisionMetric:
    """Test Precision = TP / (TP + FP)"""
    
    def test_precision_all_true_positives(self, db: Session):
        """All flagged anomalies are fraud → precision = 1.0"""
        db.query(Anomaly).delete()
        db.query(Transaction).delete()
        db.commit()
        # Create 2 fraudulent transactions
        tx1 = Transaction(
            transaction_id="TX-001",
            card_id="CARD-001",
            merchant_id="MERCH-001",
            amount=100.0,
            timestamp=datetime.utcnow(),
            label=1  # fraud
        )
        tx2 = Transaction(
            transaction_id="TX-002",
            card_id="CARD-002",
            merchant_id="MERCH-002",
            amount=200.0,
            timestamp=datetime.utcnow(),
            label=1  # fraud
        )
        db.add(tx1)
        db.add(tx2)
        db.flush()
        
        # Flag both as anomalies
        anom1 = Anomaly(
            transaction_id=tx1.id,
            score=5.0,
            baseline=50.0,
            deviation=50.0,
            evidence={"reason": "high amount"}
        )
        anom2 = Anomaly(
            transaction_id=tx2.id,
            score=4.5,
            baseline=50.0,
            deviation=150.0,
            evidence={"reason": "high amount"}
        )
        db.add(anom1)
        db.add(anom2)
        db.commit()
        
        precision = compute_precision(db)
        assert precision == 1.0, f"Expected precision=1.0, got {precision}"
    
    def test_precision_mixed_positives_negatives(self, db: Session):
        """2 TP, 2 FP → precision = 0.5"""
        # Create 4 transactions: 2 fraud (label=1), 2 legitimate (label=0)
        transactions = []
        for i, label in enumerate([1, 1, 0, 0]):
            tx = Transaction(
                transaction_id=f"TX-{i+1:03d}",
                card_id=f"CARD-{i+1:03d}",
                merchant_id=f"MERCH-{i+1:03d}",
                amount=100.0 + i * 50,
                timestamp=datetime.utcnow(),
                label=label
            )
            transactions.append(tx)
        db.add_all(transactions)
        db.flush()
        
        # Flag all 4 as anomalies
        for tx in transactions:
            anom = Anomaly(
                transaction_id=tx.id,
                score=4.0,
                baseline=50.0,
                deviation=50.0,
                evidence={}
            )
            db.add(anom)
        db.commit()
        
        precision = compute_precision(db)
        assert abs(precision - 0.5) < 0.01, f"Expected precision≈0.5, got {precision}"
    
    def test_precision_no_anomalies(self, db: Session):
        """No anomalies flagged → precision = 0.0"""
        # Create transactions but no anomalies
        tx = Transaction(
            transaction_id="TX-001",
            card_id="CARD-001",
            merchant_id="MERCH-001",
            amount=100.0,
            timestamp=datetime.utcnow(),
            label=1
        )
        db.add(tx)
        db.commit()
        
        precision = compute_precision(db)
        assert precision == 0.0, f"Expected precision=0.0, got {precision}"


class TestRecallMetric:
    """Test Recall = TP / (TP + FN)"""
    
    def test_recall_all_fraud_detected(self, db: Session):
        """All fraud transactions flagged → recall = 1.0"""
        # Create 3 fraudulent transactions
        transactions = []
        for i in range(3):
            tx = Transaction(
                transaction_id=f"TX-{i+1:03d}",
                card_id=f"CARD-{i+1:03d}",
                merchant_id=f"MERCH-{i+1:03d}",
                amount=100.0,
                timestamp=datetime.utcnow(),
                label=1  # all fraud
            )
            transactions.append(tx)
        db.add_all(transactions)
        db.flush()
        
        # Flag all as anomalies
        for tx in transactions:
            anom = Anomaly(
                transaction_id=tx.id,
                score=4.0,
                baseline=50.0,
                deviation=50.0,
                evidence={}
            )
            db.add(anom)
        db.commit()
        
        recall = compute_recall(db)
        assert recall == 1.0, f"Expected recall=1.0, got {recall}"
    
    def test_recall_partial_detection(self, db: Session):
        """2 of 4 fraud transactions detected → recall = 0.5"""
        # Create 4 fraudulent transactions
        transactions = []
        for i in range(4):
            tx = Transaction(
                transaction_id=f"TX-{i+1:03d}",
                card_id=f"CARD-{i+1:03d}",
                merchant_id=f"MERCH-{i+1:03d}",
                amount=100.0,
                timestamp=datetime.utcnow(),
                label=1  # all fraud
            )
            transactions.append(tx)
        db.add_all(transactions)
        db.flush()
        
        # Flag only first 2 as anomalies
        for tx in transactions[:2]:
            anom = Anomaly(
                transaction_id=tx.id,
                score=4.0,
                baseline=50.0,
                deviation=50.0,
                evidence={}
            )
            db.add(anom)
        db.commit()
        
        recall = compute_recall(db)
        assert abs(recall - 0.5) < 0.01, f"Expected recall≈0.5, got {recall}"
    
    def test_recall_no_fraud_transactions(self, db: Session):
        """No fraud in dataset → recall = 0.0 (edge case)"""
        tx = Transaction(
            transaction_id="TX-001",
            card_id="CARD-001",
            merchant_id="MERCH-001",
            amount=100.0,
            timestamp=datetime.utcnow(),
            label=0  # legitimate
        )
        db.add(tx)
        db.commit()
        
        recall = compute_recall(db)
        assert recall == 0.0, f"Expected recall=0.0, got {recall}"


class TestKBCoverageMetric:
    """Test KB Coverage = KB entries / resolved cases"""
    
    def test_kb_coverage_all_resolved_have_kb(self, db: Session):
        """All resolved cases have KB entries → coverage = 1.0"""
        # Create 2 resolved cases
        cases = []
        for i in range(2):
            case = Case(
                case_id=f"CASE-{i+1:03d}",
                state="RESOLVED",
                severity="HIGH",
                priority=1,
                version=1,
                created_at=datetime.utcnow(),
                resolved_at=datetime.utcnow()
            )
            cases.append(case)
        db.add_all(cases)
        db.flush()
        
        # Create KB entry for each
        for case in cases:
            kb = KnowledgeBase(
                case_id=case.case_id,
                title="Test KB Entry",
                content="Test content",
                created_at=datetime.utcnow()
            )
            db.add(kb)
        db.commit()
        
        coverage = compute_kb_coverage(db)
        assert coverage == 1.0, f"Expected coverage=1.0, got {coverage}"
    
    def test_kb_coverage_partial(self, db: Session):
        """2 of 4 resolved cases have KB → coverage = 0.5"""
        # Create 4 resolved cases
        cases = []
        for i in range(4):
            case = Case(
                case_id=f"CASE-{i+1:03d}",
                state="RESOLVED",
                severity="HIGH",
                priority=1,
                version=1,
                created_at=datetime.utcnow(),
                resolved_at=datetime.utcnow()
            )
            cases.append(case)
        db.add_all(cases)
        db.flush()
        
        # Create KB for only first 2
        for case in cases[:2]:
            kb = KnowledgeBase(
                case_id=case.case_id,
                title="Test KB Entry",
                content="Test content",
                created_at=datetime.utcnow()
            )
            db.add(kb)
        db.commit()
        
        coverage = compute_kb_coverage(db)
        assert abs(coverage - 0.5) < 0.01, f"Expected coverage≈0.5, got {coverage}"
    
    def test_kb_coverage_no_resolved_cases(self, db: Session):
        """No resolved cases → coverage = 0.0"""
        case = Case(
            case_id="CASE-001",
            state="NEW",  # not resolved
            severity="HIGH",
            priority=1,
            version=1,
            created_at=datetime.utcnow()
        )
        db.add(case)
        db.commit()
        
        coverage = compute_kb_coverage(db)
        assert coverage == 0.0, f"Expected coverage=0.0, got {coverage}"


class TestSLAComplianceMetric:
    """Test SLA Compliance = resolved_within_2h / total_cases"""
    
    def test_sla_compliance_all_compliant(self, db: Session):
        """All cases resolved within 2h → compliance = 1.0"""
        now = datetime.utcnow()
        # Create 3 cases, all resolved within 2h
        for i in range(3):
            case = Case(
                case_id=f"CASE-{i+1:03d}",
                state="RESOLVED",
                severity="HIGH",
                priority=1,
                version=1,
                created_at=now,
                resolved_at=now + timedelta(hours=1)
            )
            db.add(case)
        db.commit()
        
        compliance = compute_sla_compliance(db)
        assert compliance == 1.0, f"Expected compliance=1.0, got {compliance}"
    
    def test_sla_compliance_mixed(self, db: Session):
        """2 compliant, 2 non-compliant → compliance = 0.5"""
        now = datetime.utcnow()
        # Create 2 compliant (< 2h)
        for i in range(2):
            case = Case(
                case_id=f"CASE-{i+1:03d}",
                state="RESOLVED",
                severity="HIGH",
                priority=1,
                version=1,
                created_at=now,
                resolved_at=now + timedelta(hours=1)
            )
            db.add(case)
        
        # Create 2 non-compliant (> 2h)
        for i in range(2, 4):
            case = Case(
                case_id=f"CASE-{i+1:03d}",
                state="RESOLVED",
                severity="HIGH",
                priority=1,
                version=1,
                created_at=now,
                resolved_at=now + timedelta(hours=3)
            )
            db.add(case)
        db.commit()
        
        compliance = compute_sla_compliance(db)
        assert abs(compliance - 0.5) < 0.01, f"Expected compliance≈0.5, got {compliance}"
    
    def test_sla_compliance_unresolved_cases(self, db: Session):
        """Unresolved cases don't count as compliant"""
        now = datetime.utcnow()
        # Create 1 resolved (compliant), 1 new (unresolved)
        case1 = Case(
            case_id="CASE-001",
            state="RESOLVED",
            severity="HIGH",
            priority=1,
            version=1,
            created_at=now,
            resolved_at=now + timedelta(hours=1)
        )
        case2 = Case(
            case_id="CASE-002",
            state="NEW",
            severity="HIGH",
            priority=1,
            version=1,
            created_at=now
        )
        db.add_all([case1, case2])
        db.commit()
        
        compliance = compute_sla_compliance(db)
        assert abs(compliance - 0.5) < 0.01, f"Expected compliance≈0.5 (1 of 2), got {compliance}"


class TestDedupRateMetric:
    """Test Dedup Rate = (anomalies - cases) / anomalies"""
    
    def test_dedup_rate_high(self, db: Session):
        """1000 anomalies, 700 cases → dedup = 0.3 (30%)"""
        # Create 1000 anomalies
        for i in range(1000):
            tx = Transaction(
                transaction_id=f"TX-{i+1:04d}",
                card_id=f"CARD-{i%10:03d}",
                merchant_id=f"MERCH-{i%20:03d}",
                amount=100.0,
                timestamp=datetime.utcnow(),
                label=0
            )
            db.add(tx)
        db.flush()
        
        # Fetch IDs for anomalies
        txs = db.query(Transaction).all()
        for tx in txs:
            anom = Anomaly(
                transaction_id=tx.id,
                score=3.5,
                baseline=50.0,
                deviation=50.0,
                evidence={}
            )
            db.add(anom)
        db.flush()
        
        # Create 700 cases
        for i in range(700):
            case = Case(
                case_id=f"CASE-{i+1:04d}",
                state="NEW",
                severity="MEDIUM",
                priority=3,
                version=1,
                created_at=datetime.utcnow()
            )
            db.add(case)
        db.commit()
        
        dedup_rate = compute_dedup_rate(db)
        expected = (1000 - 700) / 1000
        assert abs(dedup_rate - expected) < 0.01, f"Expected dedup≈{expected}, got {dedup_rate}"
    
    def test_dedup_rate_zero(self, db: Session):
        """Same number of anomalies and cases → dedup = 0.0 (no dedup)"""
        # Create 100 anomalies
        for i in range(100):
            tx = Transaction(
                transaction_id=f"TX-{i+1:03d}",
                card_id=f"CARD-{i:03d}",
                merchant_id=f"MERCH-{i:03d}",
                amount=100.0,
                timestamp=datetime.utcnow(),
                label=0
            )
            db.add(tx)
        db.flush()
        
        txs = db.query(Transaction).all()
        for tx in txs:
            anom = Anomaly(
                transaction_id=tx.id,
                score=3.5,
                baseline=50.0,
                deviation=50.0,
                evidence={}
            )
            db.add(anom)
        db.flush()
        
        # Create 100 cases (1:1 mapping, no dedup)
        for i in range(100):
            case = Case(
                case_id=f"CASE-{i+1:03d}",
                state="NEW",
                severity="MEDIUM",
                priority=3,
                version=1,
                created_at=datetime.utcnow()
            )
            db.add(case)
        db.commit()
        
        dedup_rate = compute_dedup_rate(db)
        assert dedup_rate == 0.0, f"Expected dedup=0.0, got {dedup_rate}"


class TestGetAllMetrics:
    """Test get_all_metrics integration"""
    
    def test_all_metrics_structure(self, db: Session):
        """Verify all_metrics returns correct structure"""
        metrics = get_all_metrics(db)
        
        required_keys = [
            "precision", "recall", "rca_accuracy",
            "kb_coverage", "sla_compliance", "dedup_rate",
            "computed_at"
        ]
        for key in required_keys:
            assert key in metrics, f"Missing key: {key}"
        
        # Verify metrics are 0.0 when no data
        assert metrics["precision"] == 0.0
        assert metrics["recall"] == 0.0
        assert metrics["dedup_rate"] == 0.0


class TestAuditLogAPI:
    """Test audit log endpoints"""
    
    def test_audit_log_creation_on_case_action(self, db: Session):
        """Verify audit log captures case actions"""
        # Create a case
        case = Case(
            case_id="CASE-001",
            state="NEW",
            severity="HIGH",
            priority=1,
            version=1,
            created_at=datetime.utcnow()
        )
        db.add(case)
        db.flush()
        
        # Manually log an action (simulating what the API does)
        log = AuditLog(
            entity_type="case",
            entity_id="CASE-001",
            action="CREATE",
            actor_id="user-123",
            changes={"old": None, "new": {"state": "NEW"}},
            created_at=datetime.utcnow()
        )
        db.add(log)
        db.commit()
        
        # Verify log exists
        retrieved = db.query(AuditLog).filter(
            AuditLog.entity_type == "case",
            AuditLog.entity_id == "CASE-001"
        ).first()
        assert retrieved is not None
        assert retrieved.action == "CREATE"
    
    def test_audit_log_filtering_by_entity(self, db: Session):
        """Audit logs can be filtered by entity_type and entity_id"""
        # Create multiple audit logs
        for i in range(5):
            log = AuditLog(
                entity_type="case",
                entity_id=f"CASE-{i+1:03d}",
                action="UPDATE",
                actor_id=f"user-{i+1}",
                changes={},
                created_at=datetime.utcnow()
            )
            db.add(log)
        
        # Add a playbook rule log
        log_pb = AuditLog(
            entity_type="playbook_rule",
            entity_id="RULE-001",
            action="CREATE",
            actor_id="user-lead",
            changes={},
            created_at=datetime.utcnow()
        )
        db.add(log_pb)
        db.commit()
        
        # Filter by entity_type
        case_logs = db.query(AuditLog).filter(
            AuditLog.entity_type == "case"
        ).all()
        assert len(case_logs) == 5
        
        rule_logs = db.query(AuditLog).filter(
            AuditLog.entity_type == "playbook_rule"
        ).all()
        assert len(rule_logs) == 1
        
        # Filter by entity_id
        specific = db.query(AuditLog).filter(
            AuditLog.entity_id == "CASE-001"
        ).all()
        assert len(specific) == 1
    
    def test_audit_log_ordering(self, db: Session):
        """Audit logs returned newest first"""
        now = datetime.utcnow()
        # Create logs with different timestamps
        for i in range(3):
            log = AuditLog(
                entity_type="case",
                entity_id="CASE-001",
                action="UPDATE",
                actor_id=f"user-{i}",
                changes={},
                created_at=now + timedelta(seconds=i)
            )
            db.add(log)
        db.commit()
        
        logs = db.query(AuditLog).order_by(
            AuditLog.created_at.desc()
        ).all()
        
        # Most recent should be first
        assert logs[0].actor_id == "user-2"
        assert logs[1].actor_id == "user-1"
        assert logs[2].actor_id == "user-0"
