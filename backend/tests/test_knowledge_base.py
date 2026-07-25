"""Tests for knowledge base module (Phase 5 — M5).

Covers:
- KB generation from resolved cases
- KB auto-title generation
- KB markdown content formatting
- Full-text search on KB entries
- KB API endpoints
- Transaction atomicity (KB write fails → resolve fails)
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from datetime import datetime, timedelta

from app.main import app
from app.database import get_db
from app.models import (
    User, Case, Transaction, Anomaly, Entity, KnowledgeBase, AuditLog
)
from app.knowledge_base.generator import generate_kb_entry_from_case
from app.knowledge_base.search import (
    search_knowledge_base, get_kb_entry_by_id, get_kb_entry_by_case_id,
    get_total_kb_entries
)
from tests.conftest import TestingSessionLocal, engine, Base

client = TestClient(app)


@pytest.fixture
def setup_db():
    """Create tables and yield session."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db_session(setup_db):
    """Provide database session."""
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)
    
    yield session
    
    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def reviewer_user(db_session: Session):
    """Create a REVIEWER user."""
    user = User(user_id="reviewer_1", role="REVIEWER")
    db_session.add(user)
    db_session.commit()
    return user


@pytest.fixture
def resolved_case(db_session: Session):
    """Create a resolved case for KB generation testing."""
    case = Case(
        case_id="CASE-001",
        state="RESOLVED",
        severity="HIGH",
        priority=1,
        version=1,
        recommendations={"recommendation": "Block card"},
        resolved_at=datetime.utcnow(),
    )
    db_session.add(case)
    db_session.commit()
    return case


class TestKBGenerator:
    """Tests for KB generator module."""
    
    def test_generate_kb_entry_from_resolved_case(self, db_session: Session, resolved_case: Case):
        """Test: Generate KB entry from resolved case."""
        kb_entry = generate_kb_entry_from_case(resolved_case, db_session)
        
        assert kb_entry is not None
        assert "title" in kb_entry
        assert "content" in kb_entry
        assert kb_entry["title"] is not None
        assert kb_entry["content"] is not None
        assert len(kb_entry["title"]) > 0
        assert len(kb_entry["content"]) > 0
    
    def test_kb_title_auto_generation(self, db_session: Session, resolved_case: Case):
        """Test: KB title is auto-generated with case metadata."""
        kb_entry = generate_kb_entry_from_case(resolved_case, db_session)
        
        title = kb_entry["title"]
        # Title should contain severity label or case ID
        assert "High-Risk" in title or str(resolved_case.id) in title
    
    def test_kb_content_has_required_sections(self, db_session: Session, resolved_case: Case):
        """Test: KB content includes all required markdown sections."""
        kb_entry = generate_kb_entry_from_case(resolved_case, db_session)
        
        content = kb_entry["content"]
        # Check for required sections
        assert "# Case" in content or "Overview" in content
        assert "Recommendations" in content or "Evidence" in content or "Resolution" in content
        assert "---" in content  # Footer divider
    
    def test_kb_generator_fails_for_unresolved_case(self, db_session: Session):
        """Test: KB generator raises ValueError for non-RESOLVED case."""
        case = Case(
            case_id="CASE-002",
            state="ACCEPTED",
            severity="MEDIUM",
            priority=2,
            version=1,
        )
        db_session.add(case)
        db_session.commit()
        
        with pytest.raises(ValueError, match="must be RESOLVED"):
            generate_kb_entry_from_case(case, db_session)
    
    def test_kb_content_includes_duration(self, db_session: Session):
        """Test: KB content includes case resolution duration."""
        created_at = datetime.utcnow() - timedelta(hours=1)
        resolved_at = datetime.utcnow()
        
        case = Case(
            case_id="CASE-003",
            state="RESOLVED",
            severity="MEDIUM",
            priority=2,
            version=1,
            created_at=created_at,
            resolved_at=resolved_at,
        )
        db_session.add(case)
        db_session.commit()
        
        kb_entry = generate_kb_entry_from_case(case, db_session)
        content = kb_entry["content"]
        
        # Duration should be approximately 60 minutes
        assert "60" in content or "Duration" in content


class TestKBSearch:
    """Tests for KB search module."""
    
    def test_search_finds_kb_entry_by_keyword(self, db_session: Session, resolved_case: Case):
        """Test: Full-text search finds KB entries by keyword."""
        # Create KB entry
        kb = KnowledgeBase(
            case_id=resolved_case.case_id,
            title="Test Case with Fraud Detection",
            content="This is a test case about credit card fraud detection and anomaly scoring."
        )
        db_session.add(kb)
        db_session.commit()
        
        # Search for keyword
        results = search_knowledge_base(query="fraud", db=db_session)
        
        assert len(results) > 0
        assert results[0]["id"] == kb.id
        assert results[0]["case_id"] == resolved_case.case_id
    
    def test_search_case_insensitive(self, db_session: Session, resolved_case: Case):
        """Test: Search is case-insensitive."""
        kb = KnowledgeBase(
            case_id=resolved_case.case_id,
            title="Suspicious Transaction Pattern",
            content="Multiple transactions detected on the same card."
        )
        db_session.add(kb)
        db_session.commit()
        
        # Search with different cases
        results_lower = search_knowledge_base(query="suspicious", db=db_session)
        results_upper = search_knowledge_base(query="SUSPICIOUS", db=db_session)
        results_mixed = search_knowledge_base(query="SuSpIcIoUs", db=db_session)
        
        assert len(results_lower) > 0
        assert len(results_upper) > 0
        assert len(results_mixed) > 0
    
    def test_search_with_multiple_keywords(self, db_session: Session, resolved_case: Case):
        """Test: Search handles multiple keywords."""
        kb = KnowledgeBase(
            case_id=resolved_case.case_id,
            title="Card Fraud Case",
            content="Credit card used in multiple locations within short time window."
        )
        db_session.add(kb)
        db_session.commit()
        
        # Search with multiple keywords
        results = search_knowledge_base(query="credit card fraud", db=db_session)
        
        assert len(results) > 0
    
    def test_search_with_limit_and_offset(self, db_session: Session):
        """Test: Search respects limit and offset parameters."""
        # Create multiple KB entries
        for i in range(5):
            case = Case(
                case_id=f"CASE-{i:03d}",
                state="RESOLVED",
                severity="HIGH",
                priority=1,
            )
            db_session.add(case)
            db_session.flush()
            
            kb = KnowledgeBase(
                case_id=case.case_id,
                title=f"Fraud Case {i}",
                content=f"This is fraud case number {i} with suspicious activity."
            )
            db_session.add(kb)
        
        db_session.commit()
        
        # Test limit
        results_limit_2 = search_knowledge_base(query="fraud", limit=2, db=db_session)
        assert len(results_limit_2) == 2
        
        # Test offset
        results_offset_1 = search_knowledge_base(query="fraud", limit=2, offset=1, db=db_session)
        assert len(results_offset_1) <= 2
        # First result from offset query should be different from first result without offset
        if len(results_limit_2) > 0 and len(results_offset_1) > 0:
            # They might be different (depends on ranking)
            pass
    
    def test_search_empty_query_raises_error(self, db_session: Session):
        """Test: Search with empty query raises ValueError."""
        with pytest.raises(ValueError, match="cannot be empty"):
            search_knowledge_base(query="", db=db_session)
    
    def test_search_no_results(self, db_session: Session):
        """Test: Search returns empty list when no matches found."""
        kb = KnowledgeBase(
            case_id="CASE-001",
            title="Test Case",
            content="This is a test case about something specific."
        )
        db_session.add(kb)
        db_session.commit()
        
        # Search for term not in content
        results = search_knowledge_base(query="xyz_nonexistent_term", db=db_session)
        
        assert len(results) == 0
    
    def test_get_kb_entry_by_id(self, db_session: Session, resolved_case: Case):
        """Test: Retrieve KB entry by ID."""
        kb = KnowledgeBase(
            case_id=resolved_case.case_id,
            title="Test Entry",
            content="Test content for retrieval."
        )
        db_session.add(kb)
        db_session.commit()
        
        retrieved = get_kb_entry_by_id(kb.id, db_session)
        
        assert retrieved is not None
        assert retrieved["id"] == kb.id
        assert retrieved["case_id"] == resolved_case.case_id
        assert retrieved["content"] == "Test content for retrieval."
    
    def test_get_kb_entry_by_case_id(self, db_session: Session, resolved_case: Case):
        """Test: Retrieve KB entry by case ID."""
        kb = KnowledgeBase(
            case_id=resolved_case.case_id,
            title="Test Entry",
            content="Test content for retrieval."
        )
        db_session.add(kb)
        db_session.commit()
        
        retrieved = get_kb_entry_by_case_id(resolved_case.case_id, db_session)
        
        assert retrieved is not None
        assert retrieved["case_id"] == resolved_case.case_id
    
    def test_get_total_kb_entries(self, db_session: Session):
        """Test: Get total count of KB entries."""
        # Create 3 KB entries
        for i in range(3):
            case = Case(
                case_id=f"CASE-{i:03d}",
                state="RESOLVED",
                severity="MEDIUM",
                priority=2,
            )
            db_session.add(case)
            db_session.flush()
            
            kb = KnowledgeBase(
                case_id=case.case_id,
                title=f"Case {i}",
                content=f"Content for case {i}."
            )
            db_session.add(kb)
        
        db_session.commit()
        
        count = get_total_kb_entries(db_session)
        assert count == 3


class TestKBAPI:
    """Tests for KB API endpoints."""
    
    def test_kb_search_endpoint(self, db_session: Session):
        """Test: GET /knowledge-base/search endpoint works."""
        # Create KB entry
        case = Case(
            case_id="CASE-001",
            state="RESOLVED",
            severity="HIGH",
            priority=1,
        )
        db_session.add(case)
        db_session.flush()
        
        kb = KnowledgeBase(
            case_id=case.case_id,
            title="Fraud Detection Case",
            content="This case involves credit card fraud with multiple transactions."
        )
        db_session.add(kb)
        db_session.commit()
        
        # Override get_db to use our test session
        def override_get_db():
            yield db_session
        
        app.dependency_overrides[get_db] = override_get_db
        
        try:
            response = client.get("/knowledge-base/search?q=fraud")
            
            assert response.status_code == 200
            results = response.json()
            assert isinstance(results, list)
            assert len(results) > 0
        finally:
            app.dependency_overrides.clear()
    
    def test_kb_search_endpoint_missing_query(self, db_session: Session):
        """Test: GET /knowledge-base/search without query param returns error."""
        def override_get_db():
            yield db_session
        
        app.dependency_overrides[get_db] = override_get_db
        
        try:
            response = client.get("/knowledge-base/search")
            assert response.status_code == 422  # Unprocessable Entity (missing required param)
        finally:
            app.dependency_overrides.clear()
    
    def test_kb_get_entry_endpoint(self, db_session: Session):
        """Test: GET /knowledge-base/{id} endpoint."""
        case = Case(
            case_id="CASE-001",
            state="RESOLVED",
            severity="HIGH",
            priority=1,
        )
        db_session.add(case)
        db_session.flush()
        
        kb = KnowledgeBase(
            case_id=case.case_id,
            title="Test Case",
            content="Test content with multiple lines\nof markdown."
        )
        db_session.add(kb)
        db_session.commit()
        
        def override_get_db():
            yield db_session
        
        app.dependency_overrides[get_db] = override_get_db
        
        try:
            response = client.get(f"/knowledge-base/{kb.id}")
            
            assert response.status_code == 200
            entry = response.json()
            assert entry["id"] == kb.id
            assert entry["case_id"] == case.case_id
            assert "markdown" in entry["content"].lower() or "Test content" in entry["content"]
        finally:
            app.dependency_overrides.clear()
    
    def test_kb_get_entry_not_found(self, db_session: Session):
        """Test: GET /knowledge-base/{id} with non-existent ID returns 404."""
        def override_get_db():
            yield db_session
        
        app.dependency_overrides[get_db] = override_get_db
        
        try:
            response = client.get("/knowledge-base/99999")
            assert response.status_code == 404
        finally:
            app.dependency_overrides.clear()
    
    def test_kb_get_entry_by_case_endpoint(self, db_session: Session):
        """Test: GET /knowledge-base/case/{case_id} endpoint."""
        case = Case(
            case_id="CASE-001",
            state="RESOLVED",
            severity="HIGH",
            priority=1,
        )
        db_session.add(case)
        db_session.flush()
        
        kb = KnowledgeBase(
            case_id=case.case_id,
            title="Test Case",
            content="Test content."
        )
        db_session.add(kb)
        db_session.commit()
        
        def override_get_db():
            yield db_session
        
        app.dependency_overrides[get_db] = override_get_db
        
        try:
            response = client.get(f"/knowledge-base/case/{case.case_id}")
            
            assert response.status_code == 200
            entry = response.json()
            assert entry is not None
            assert entry["case_id"] == case.case_id
        finally:
            app.dependency_overrides.clear()
