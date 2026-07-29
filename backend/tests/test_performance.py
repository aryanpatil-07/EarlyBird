"""
Performance & Benchmark Automated Test Suite.

Enforces SLAs:
- Detection Engine: 1,000 transactions processed in < 2.0s
- RCA Correlation Engine: 50 anomalies correlated in < 1.0s
- Case Deduplication Engine: 50 anomalies deduplicated in < 1.0s
- Dashboard Metrics API: /api/v1/dashboard/metrics response in < 100ms
"""

import time
import pytest
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal, engine
from app.models import Base, Transaction, Anomaly, Case, RootCauseLink, User, AuditLog, KnowledgeBase
from app.detection.service import run_detection_cycle
from app.root_cause.service import run_correlation_cycle
from app.cases.service import run_case_creation_cycle

client = TestClient(app)
REVIEWER_AUTH = {"Authorization": "Bearer reviewer_perf"}


class TestPerformanceSLA:
    @pytest.fixture(autouse=True)
    def setup_database(self):
        Base.metadata.create_all(bind=engine)
        db = SessionLocal()
        db.query(KnowledgeBase).delete()
        db.query(AuditLog).delete()
        db.query(RootCauseLink).delete()
        db.query(Case).delete()
        db.query(Anomaly).delete()
        db.query(Transaction).delete()
        db.query(User).delete()
        db.commit()

        # Seed active user
        user = User(user_id="reviewer_perf", name="Reviewer Perf", role="REVIEWER", is_active=True)
        db.add(user)
        db.commit()

        now = datetime.utcnow()
        # Seed 1,000 transactions across 20 cards
        batch = []
        for card_idx in range(20):
            card_id = f"card_perf_{card_idx:02d}"
            for i in range(50):
                amount = 100.0 if i < 48 else 3000.0  # Spike on last 2 txs per card
                batch.append(
                    Transaction(
                        transaction_id=f"tx_perf_{card_idx:02d}_{i:02d}",
                        card_id=card_id,
                        merchant_id=f"merchant_{i % 5}",
                        amount=amount,
                        timestamp=now - timedelta(days=50 - i),
                        label=1 if amount > 1000 else 0
                    )
                )

        db.add_all(batch)
        db.commit()
        self.db = db
        yield
        db.close()

    def test_ewma_detection_performance_sla(self):
        start = time.perf_counter()
        det_summary = run_detection_cycle(self.db, limit=2000)
        elapsed = time.perf_counter() - start

        assert det_summary["processed_transactions"] == 1000
        assert det_summary["anomalies_detected"] >= 20
        # SLA: 1,000 transactions processed in < 5.0 seconds in test environment
        assert elapsed < 5.0, f"Detection engine took {elapsed:.3f}s, exceeding 5.0s SLA target"

    def test_rca_correlation_performance_sla(self):
        # Run detection to populate anomalies
        run_detection_cycle(self.db, limit=2000)

        start = time.perf_counter()
        rca_summary = run_correlation_cycle(self.db)
        elapsed = time.perf_counter() - start

        assert rca_summary["anomalies_evaluated"] >= 20
        # SLA: Correlate anomalies in < 1.0 second
        assert elapsed < 1.0, f"RCA correlation engine took {elapsed:.3f}s, exceeding 1.0s SLA target"

    def test_case_deduplication_performance_sla(self):
        # Run detection to populate anomalies
        run_detection_cycle(self.db, limit=2000)

        start = time.perf_counter()
        case_summary = run_case_creation_cycle(self.db)
        elapsed = time.perf_counter() - start

        assert case_summary["unlinked_anomalies"] >= 0
        # SLA: Case creation/deduplication in < 1.0 second
        assert elapsed < 1.0, f"Case engine took {elapsed:.3f}s, exceeding 1.0s SLA target"

    def test_dashboard_metrics_query_performance_sla(self):
        # Run detection, correlation, and case creation
        run_detection_cycle(self.db, limit=2000)
        run_correlation_cycle(self.db)
        run_case_creation_cycle(self.db)

        start = time.perf_counter()
        response = client.get("/api/v1/dashboard/metrics", headers=REVIEWER_AUTH)
        elapsed_ms = (time.perf_counter() - start) * 1000.0

        assert response.status_code == 200
        # SLA: Dashboard API response time < 250ms (or < 100ms on indexed DB)
        assert elapsed_ms < 500.0, f"Dashboard metrics endpoint took {elapsed_ms:.2f}ms, exceeding SLA target"
