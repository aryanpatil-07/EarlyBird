"""
Test health check endpoint.

Phase 0: Verify FastAPI is running and responding.
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app


@pytest.fixture
def client():
    """Create test client."""
    return TestClient(app)


def test_health_check(client):
    """Test health check endpoint returns 200."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert "service" in response.json()


def test_root_endpoint(client):
    """Test root endpoint returns welcome message."""
    response = client.get("/")
    assert response.status_code == 200
    assert "message" in response.json()
    assert "EarlyBird" in response.json()["message"]

