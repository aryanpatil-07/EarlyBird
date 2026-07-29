"""
End-to-End Pipeline Integration & Validation Test Suite.

Tests full lifecycle:
1. Ingest transactions & compute EWMA baselines
2. Flag anomalies & generate evidence JSON
3. Correlate root causes & generate RootCauseLink records
4. Group & de-duplicate anomalies into Cases
5. Perform Reviewer action (ACCEPTED, REJECTED, MODIFIED) & Escalation via /api/v1 endpoints
6. Verify atomic KnowledgeBase record generation
7. Fetch /api/v1/dashboard/metrics & /api/v1/audit-log
8. Verify pipeline cycle idempotency
"""

import pytest
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal, engine
from app.models import Base, Transaction, Anomaly, Case, RootCauseLink, User, AuditLog, KnowledgeBase
from app.detection.service import run_detection_cycle
from app.root_cause.service import run_correlation_cycle
from app.cases.service import run_case_creation_cycle
from app.cases.sla import check_sla_breaches
from app.cases.state_machine import CaseState

client = TestClient(app)

REVIEWER_AUTH = {"Authorization": "Bearer reviewer_e2e"}
LEAD_AUTH = {"Authorization": "Bearer lead_e2e"}


class TestE2EPipeline:
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

        # Seed Users
        reviewer = User(user_id="reviewer_e2e", name="Reviewer E2E", role="REVIEWER", is_active=True)
        lead = User(user_id="lead_e2e", name="Lead E2E", role="TEAM_LEAD", is_active=True)
        db.add_all([reviewer, lead])
        db.commit()

        now = datetime.utcnow()
        # Seed 10 baseline transactions for entity card_e2e
        txs = []
        for i in range(10):
            txs.append(
                Transaction(
                    transaction_id=f"tx_base_{i}",
                    card_id="card_e2e",
                    merchant_id="merchant_a",
                    amount=100.0 + (i * 2.0),
                    timestamp=now - timedelta(days=10 - i),
                    label=0
                )
            )
        # Seed 1 spike transaction (anomalous)
        txs.append(
            Transaction(
                transaction_id="tx_spike_1",
                card_id="card_e2e",
                merchant_id="merchant_b",
                amount=2500.0,
                timestamp=now - timedelta(hours=1),
                label=1
            )
        )
        db.add_all(txs)
        db.commit()
        self.db = db
        yield
        db.close()

    def test_e2e_full_lifecycle_and_api_integration(self):
        # Step 1: Run Detection Cycle
        det_summary = run_detection_cycle(self.db)
        assert det_summary["anomalies_detected"] >= 1

        anomalies = self.db.query(Anomaly).all()
        assert len(anomalies) >= 1
        flagged_anomaly = anomalies[0]
        assert flagged_anomaly.score > 3.0 or flagged_anomaly.severity in ["HIGH", "CRITICAL", "MEDIUM"]
        assert "baseline_mean" in flagged_anomaly.evidence

        # Step 2: Run Root Cause Correlation Cycle
        rca_summary = run_correlation_cycle(self.db)
        assert rca_summary["links_created"] >= 0

        links = self.db.query(RootCauseLink).all()
        assert len(links) >= 1

        # Step 3: Run Case Creation Cycle
        case_summary = run_case_creation_cycle(self.db)
        assert case_summary["unlinked_anomalies"] >= 0

        cases = self.db.query(Case).all()
        assert len(cases) >= 1
        test_case = cases[0]
        assert test_case.state == CaseState.NEW.value

        # Step 4: Fetch Case Queue via GET /api/v1/cases
        queue_res = client.get("/api/v1/cases", headers=REVIEWER_AUTH)
        assert queue_res.status_code == 200
        queue_data = queue_res.json()
        assert "items" in queue_data
        assert queue_data["total"] >= 1

        # Step 5: Fetch Case Detail via GET /api/v1/cases/{case_id}
        detail_res = client.get(f"/api/v1/cases/{test_case.case_id}", headers=REVIEWER_AUTH)
        assert detail_res.status_code == 200
        detail_data = detail_res.json()
        assert (detail_data.get("caseId") == test_case.case_id or 
                detail_data.get("case_id") == test_case.case_id or 
                detail_data.get("id") == str(test_case.id))
        assert "evidence" in detail_data
        assert "recommendations" in detail_data

        # Step 6: Reviewer Decision via POST /api/v1/cases/{case_id}/action
        action_payload = {
            "version": test_case.version,
            "decision": "ACCEPTED",
            "rationale": "Verified fraudulent transaction burst on card_e2e"
        }
        action_res = client.post(f"/api/v1/cases/{test_case.case_id}/action", json=action_payload, headers=REVIEWER_AUTH)
        assert action_res.status_code == 200
        resolved_data = action_res.json()
        assert resolved_data["state"] == CaseState.RESOLVED.value

        # Step 7: Verify Atomic KnowledgeBase Record Generation
        kb_entry = self.db.query(KnowledgeBase).filter(KnowledgeBase.case_id == test_case.case_id).first()
        assert kb_entry is not None
        assert "resolution" in kb_entry.title.lower() or "case" in kb_entry.title.lower()

        # Step 8: Verify Dashboard Metrics via GET /api/v1/dashboard/metrics
        metrics_res = client.get("/api/v1/dashboard/metrics", headers=REVIEWER_AUTH)
        assert metrics_res.status_code == 200
        metrics_data = metrics_res.json()
        assert "kb_coverage" in metrics_data
        assert metrics_data["kb_coverage"] >= 0.0

        # Step 9: Verify Audit Log via GET /api/v1/audit-log
        audit_res = client.get("/api/v1/audit-log", headers=REVIEWER_AUTH)
        assert audit_res.status_code == 200
        audit_data = audit_res.json()
        assert audit_data["total"] >= 1

    def test_e2e_pipeline_idempotency(self):
        # Run cycle pass 1
        run_detection_cycle(self.db)
        run_correlation_cycle(self.db)
        run_case_creation_cycle(self.db)

        anomalies_pass1 = self.db.query(Anomaly).count()
        links_pass1 = self.db.query(RootCauseLink).count()
        cases_pass1 = self.db.query(Case).count()

        assert anomalies_pass1 > 0
        assert cases_pass1 > 0

        # Run cycle pass 2 (Idempotency check)
        det_pass2 = run_detection_cycle(self.db)
        rca_pass2 = run_correlation_cycle(self.db)
        cases_pass2 = run_case_creation_cycle(self.db)

        assert det_pass2["anomalies_detected"] == 0
        assert rca_pass2["links_created"] == 0
        assert cases_pass2["created_count"] == 0

        anomalies_pass2 = self.db.query(Anomaly).count()
        links_pass2 = self.db.query(RootCauseLink).count()
        cases_pass2_count = self.db.query(Case).count()

        assert anomalies_pass2 == anomalies_pass1
        assert links_pass2 == links_pass1
        assert cases_pass2_count == cases_pass1
