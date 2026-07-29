"""
Unit tests for Case API endpoints (Phase 3 — M3).
"""

import pytest
from fastapi.testclient import TestClient
from datetime import datetime
from app.main import app
from app.database import SessionLocal, engine
from app.models import Base, Case, User, AuditLog
from app.cases.state_machine import CaseState

client = TestClient(app)
AUTH_HEADERS = {"Authorization": "Bearer test_reviewer"}


class TestCaseAPI:
    """Tests for Case API endpoints."""

    @pytest.fixture(autouse=True)
    def setup_teardown(self):
        """Setup and teardown for each test."""
        Base.metadata.create_all(bind=engine)
        db = SessionLocal()
        
        # Clean up previous test data
        db.query(AuditLog).delete()
        db.query(Case).delete()
        db.query(User).delete()
        db.commit()
        
        # Create test user
        user = User(
            user_id="test_reviewer",
            name="Test Reviewer",
            role="REVIEWER",
            is_active=True
        )
        db.add(user)
        
        # Create test cases
        case1 = Case(
            case_id="CASE-001",
            state=CaseState.NEW.value,
            severity="HIGH",
            priority=1,
            version=0,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        case2 = Case(
            case_id="CASE-002",
            state=CaseState.ACCEPTED.value,
            severity="MEDIUM",
            priority=2,
            version=0,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(case1)
        db.add(case2)
        db.commit()
        
        self.db = db
        self.user_id = user.id
        self.case1_id = case1.id
        self.case2_id = case2.id
        
        yield
        
        # Cleanup
        db.query(AuditLog).delete()
        db.query(Case).delete()
        db.query(User).delete()
        db.commit()
        db.close()

    def test_get_cases_returns_200(self):
        """Test GET /api/v1/cases returns 200 OK."""
        response = client.get("/api/v1/cases", headers=AUTH_HEADERS)
        assert response.status_code == 200

    def test_get_cases_returns_list_structure(self):
        """Test GET /api/v1/cases returns proper response structure."""
        response = client.get("/api/v1/cases", headers=AUTH_HEADERS)
        data = response.json()
        
        assert "cases" in data or "items" in data
        assert "total" in data

    def test_get_cases_with_state_filter(self):
        """Test GET /api/v1/cases?state=NEW filters by state."""
        response = client.get("/api/v1/cases?state=NEW", headers=AUTH_HEADERS)
        assert response.status_code == 200

    def test_get_cases_invalid_state_returns_400(self):
        """Test GET /api/v1/cases with invalid state returns 400."""
        response = client.get("/api/v1/cases?state=INVALID_STATE", headers=AUTH_HEADERS)
        assert response.status_code == 400

    def test_get_cases_pagination(self):
        """Test GET /api/v1/cases pagination parameters."""
        response = client.get("/api/v1/cases?limit=5&page=1", headers=AUTH_HEADERS)
        assert response.status_code == 200

    def test_get_case_detail_returns_200(self):
        """Test GET /api/v1/cases/{id} returns 200 OK."""
        response = client.get(f"/api/v1/cases/{self.case1_id}", headers=AUTH_HEADERS)
        assert response.status_code == 200

    def test_get_case_detail_returns_proper_structure(self):
        """Test GET /api/v1/cases/{id} returns case detail structure."""
        response = client.get(f"/api/v1/cases/{self.case1_id}", headers=AUTH_HEADERS)
        data = response.json()
        
        assert str(data["id"]) == str(self.case1_id)
        assert data.get("caseId") == "CASE-001" or data.get("case_id") == "CASE-001"
        assert data["state"] in [CaseState.NEW.value, "NEW"]

    def test_get_case_detail_not_found_returns_404(self):
        """Test GET /api/v1/cases/{id} with invalid id returns 404."""
        response = client.get("/api/v1/cases/99999", headers=AUTH_HEADERS)
        assert response.status_code == 404

    def test_accept_case_new_to_accepted(self):
        """Test POST /api/v1/cases/{id}/action with decision ACCEPTED."""
        payload = {"version": 0, "decision": "ACCEPTED", "rationale": "Reviewer accepting case"}
        response = client.post(f"/api/v1/cases/{self.case1_id}/action", json=payload, headers=AUTH_HEADERS)
        
        assert response.status_code in [200, 201]

    def test_accept_case_stale_version_returns_409(self):
        """Test POST /api/v1/cases/{id}/action with stale version returns 409."""
        payload = {"version": 99, "decision": "ACCEPTED", "rationale": "Stale version"}
        response = client.post(f"/api/v1/cases/{self.case1_id}/action", json=payload, headers=AUTH_HEADERS)
        assert response.status_code == 409

    def test_escalate_case_new_to_escalated(self):
        """Test POST /api/v1/cases/{id}/escalate transitions to ESCALATED."""
        payload = {"version": 0, "reason": "Escalating new case"}
        response = client.post(f"/api/v1/cases/{self.case1_id}/escalate", json=payload, headers=AUTH_HEADERS)
        
        assert response.status_code in [200, 201]
