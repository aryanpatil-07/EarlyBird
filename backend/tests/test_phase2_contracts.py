"""
Contract tests for Phase 2 — Canonical API, Error Envelope, Concurrency & RBAC.
"""

import pytest
from fastapi.testclient import TestClient
from datetime import datetime
from app.main import app
from app.database import SessionLocal, engine
from app.models import Base, Case, User, AuditLog, KnowledgeBase, PlaybookRule
from app.cases.state_machine import CaseState

client = TestClient(app)

REVIEWER_AUTH = {"Authorization": "Bearer reviewer_p2"}
LEAD_AUTH = {"Authorization": "Bearer lead_p2"}


class TestPhase2CanonicalAPI:
    @pytest.fixture(autouse=True)
    def setup_database(self):
        Base.metadata.create_all(bind=engine)
        db = SessionLocal()
        db.query(AuditLog).delete()
        db.query(KnowledgeBase).delete()
        db.query(Case).delete()
        db.query(User).delete()
        db.commit()

        # Seed test users
        reviewer = User(user_id="reviewer_p2", name="Reviewer P2", role="REVIEWER", is_active=True)
        lead = User(user_id="lead_p2", name="Lead P2", role="TEAM_LEAD", is_active=True)
        inactive = User(user_id="inactive_p2", name="Inactive P2", role="REVIEWER", is_active=False)

        db.add_all([reviewer, lead, inactive])
        db.commit()

        # Seed test case
        case = Case(
            case_id="CASE-P2-001",
            state=CaseState.NEW.value,
            severity="HIGH",
            priority=1,
            version=1,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        db.add(case)
        db.commit()
        self.case_id = case.id
        self.db = db
        yield
        db.close()

    def test_unauthenticated_request_returns_401_error_envelope(self):
        res = client.get("/api/v1/cases")
        assert res.status_code == 401
        data = res.json()
        assert "error" in data
        assert data["error"]["code"] == "UNAUTHORIZED"

    def test_inactive_user_returns_401_error_envelope(self):
        res = client.get("/api/v1/cases", headers={"Authorization": "Bearer inactive_p2"})
        assert res.status_code == 401
        data = res.json()
        assert "error" in data
        assert "deactivated" in data["error"]["message"].lower()

    def test_stale_version_action_returns_409_error_envelope(self):
        payload = {"version": 99, "decision": "ACCEPTED", "rationale": "Valid rationale"}
        res = client.post(f"/api/v1/cases/{self.case_id}/action", json=payload, headers=REVIEWER_AUTH)
        assert res.status_code == 409
        data = res.json()
        assert "error" in data
        assert data["error"]["code"] == "STALE_CASE_STATE"

    def test_rejected_action_without_rationale_returns_400_error_envelope(self):
        payload = {"version": 1, "decision": "REJECTED"}
        res = client.post(f"/api/v1/cases/{self.case_id}/action", json=payload, headers=REVIEWER_AUTH)
        assert res.status_code == 400
        data = res.json()
        assert "error" in data
        assert "rationale" in data["error"]["message"].lower()

    def test_escalate_without_reason_returns_400_error_envelope(self):
        payload = {"version": 1, "reason": "short"}
        res = client.post(f"/api/v1/cases/{self.case_id}/escalate", json=payload, headers=REVIEWER_AUTH)
        assert res.status_code == 400
        data = res.json()
        assert "error" in data
        assert "at least 10" in data["error"]["message"].lower()

    def test_reviewer_cannot_create_playbook_rule_returns_403_error_envelope(self):
        payload = {
            "name": "Test Rule",
            "condition_json": {"amount_min": 1000},
            "recommendation": "Review transaction",
            "priority": 5
        }
        res = client.post("/api/v1/playbook-rules", json=payload, headers=REVIEWER_AUTH)
        assert res.status_code == 403
        data = res.json()
        assert "error" in data
        assert data["error"]["code"] == "FORBIDDEN"

    def test_team_lead_can_create_playbook_rule(self):
        payload = {
            "name": "Test Rule Lead",
            "condition_json": {"amount_min": 1000},
            "recommendation": "Review transaction",
            "priority": 5
        }
        res = client.post("/api/v1/playbook-rules", json=payload, headers=LEAD_AUTH)
        assert res.status_code in [200, 201]
        data = res.json()
        assert data["name"] == "Test Rule Lead"
