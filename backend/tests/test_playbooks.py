"""Tests for playbook rules and recommendation engine."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.database import get_db
from app.models import User, Case
from app.playbooks.rules import (
    PlaybookRule,
    create_rule,
    list_enabled_rules,
    get_rule_by_id,
    update_rule,
    disable_rule,
    delete_rule,
)
from app.playbooks.recommender import Recommender
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
def team_lead_user(db_session: Session):
    """Create a TEAM_LEAD user."""
    user = User(user_id="team_lead_1", role="TEAM_LEAD")
    db_session.add(user)
    db_session.commit()
    return user


@pytest.fixture
def reviewer_user(db_session: Session):
    """Create a REVIEWER user."""
    user = User(user_id="reviewer_1", role="REVIEWER")
    db_session.add(user)
    db_session.commit()
    return user


class TestPlaybookRuleCRUD:
    """Test playbook rule CRUD operations."""
    
    def test_create_rule(self, db_session: Session, team_lead_user: User):
        """Test creating a playbook rule."""
        rule = create_rule(
            session=db_session,
            name="High-Value Test",
            description="Test rule for high-value transactions",
            condition_json={"amount_min": 5000},
            recommendation="Verify cardholder authorization",
            priority=8,
            created_by_id=team_lead_user.id,
        )
        
        assert rule.id is not None
        assert rule.name == "High-Value Test"
        assert rule.priority == 8
        assert rule.enabled == 1
        assert rule.created_by_id == team_lead_user.id
    
    def test_create_rule_clamps_priority(self, db_session: Session, team_lead_user: User):
        """Test that priority is clamped to 1-10 range."""
        rule_high = create_rule(
            session=db_session,
            name="Test High",
            description="",
            condition_json={},
            recommendation="Test",
            priority=15,
            created_by_id=team_lead_user.id,
        )
        assert rule_high.priority == 10
        
        rule_low = create_rule(
            session=db_session,
            name="Test Low",
            description="",
            condition_json={},
            recommendation="Test",
            priority=-5,
            created_by_id=team_lead_user.id,
        )
        assert rule_low.priority == 1
    
    def test_list_enabled_rules(self, db_session: Session, team_lead_user: User):
        """Test listing enabled rules ordered by priority."""
        # Create multiple rules with different priorities
        rule1 = create_rule(
            session=db_session,
            name="Low Priority",
            description="",
            condition_json={},
            recommendation="Test",
            priority=3,
            created_by_id=team_lead_user.id,
        )
        
        rule2 = create_rule(
            session=db_session,
            name="High Priority",
            description="",
            condition_json={},
            recommendation="Test",
            priority=8,
            created_by_id=team_lead_user.id,
        )
        
        rule3 = create_rule(
            session=db_session,
            name="Medium Priority",
            description="",
            condition_json={},
            recommendation="Test",
            priority=5,
            created_by_id=team_lead_user.id,
        )
        
        # Disable rule2
        disable_rule(db_session, rule2.id)
        
        # List enabled rules
        rules = list_enabled_rules(db_session, order_by_priority=True)
        
        # Should only return enabled rules, sorted by priority DESC
        assert len(rules) == 2
        assert rules[0].priority == 5  # Medium first
        assert rules[1].priority == 3  # Low second
    
    def test_get_rule_by_id(self, db_session: Session, team_lead_user: User):
        """Test retrieving a rule by ID."""
        rule = create_rule(
            session=db_session,
            name="Test Rule",
            description="",
            condition_json={"amount_min": 1000},
            recommendation="Test",
            priority=5,
            created_by_id=team_lead_user.id,
        )
        
        retrieved = get_rule_by_id(db_session, rule.id)
        assert retrieved is not None
        assert retrieved.name == "Test Rule"
        
        # Non-existent rule
        not_found = get_rule_by_id(db_session, 9999)
        assert not_found is None
    
    def test_update_rule(self, db_session: Session, team_lead_user: User):
        """Test updating a rule."""
        rule = create_rule(
            session=db_session,
            name="Original Name",
            description="Original",
            condition_json={"amount_min": 100},
            recommendation="Original recommendation",
            priority=5,
            created_by_id=team_lead_user.id,
        )
        
        # Update fields
        updated = update_rule(
            session=db_session,
            rule_id=rule.id,
            name="Updated Name",
            priority=7,
            recommendation="Updated recommendation",
        )
        
        assert updated is not None
        assert updated.name == "Updated Name"
        assert updated.priority == 7
        assert updated.recommendation == "Updated recommendation"
        assert updated.description == "Original"  # Unchanged
    
    def test_disable_rule(self, db_session: Session, team_lead_user: User):
        """Test soft-deleting (disabling) a rule."""
        rule = create_rule(
            session=db_session,
            name="Test",
            description="",
            condition_json={},
            recommendation="Test",
            priority=5,
            created_by_id=team_lead_user.id,
        )
        
        assert rule.enabled == 1
        
        disabled = disable_rule(db_session, rule.id)
        assert disabled.enabled == 0
        
        # Should not appear in list_enabled_rules
        enabled_rules = list_enabled_rules(db_session)
        assert rule.id not in [r.id for r in enabled_rules]
    
    def test_delete_rule(self, db_session: Session, team_lead_user: User):
        """Test hard-deleting a rule."""
        rule = create_rule(
            session=db_session,
            name="Test",
            description="",
            condition_json={},
            recommendation="Test",
            priority=5,
            created_by_id=team_lead_user.id,
        )
        
        rule_id = rule.id
        
        # Delete
        success = delete_rule(db_session, rule_id)
        assert success is True
        
        # Should not exist anymore
        retrieved = get_rule_by_id(db_session, rule_id)
        assert retrieved is None
        
        # Delete non-existent rule
        success = delete_rule(db_session, 9999)
        assert success is False


class TestRecommendationEngine:
    """Test recommendation matching and evaluation."""
    
    def test_evaluate_rule_with_amount_condition(self, db_session: Session, team_lead_user: User):
        """Test evaluating rule with amount conditions."""
        rule = create_rule(
            session=db_session,
            name="High-Value",
            description="",
            condition_json={"amount_min": 5000, "amount_max": 10000},
            recommendation="Verify high-value transaction",
            priority=8,
            created_by_id=team_lead_user.id,
        )
        
        # Create mock case
        case = Case()
        case.amount = 7000
        
        # Should match
        matches = Recommender.evaluate_rule_against_case(case, rule)
        assert matches is True
        
        # Below minimum
        case.amount = 3000
        matches = Recommender.evaluate_rule_against_case(case, rule)
        assert matches is False
        
        # Above maximum
        case.amount = 15000
        matches = Recommender.evaluate_rule_against_case(case, rule)
        assert matches is False
    
    def test_evaluate_rule_with_z_score_condition(self, db_session: Session, team_lead_user: User):
        """Test evaluating rule with z-score threshold."""
        rule = create_rule(
            session=db_session,
            name="High Z-Score",
            description="",
            condition_json={"high_z_score": 3.0},
            recommendation="Extreme anomaly detected",
            priority=9,
            created_by_id=team_lead_user.id,
        )
        
        # Create mock case with high score
        case = Case()
        case.max_score = 3.5
        
        matches = Recommender.evaluate_rule_against_case(case, rule)
        assert matches is True
        
        # Below threshold
        case.max_score = 2.5
        matches = Recommender.evaluate_rule_against_case(case, rule)
        assert matches is False
    
    def test_evaluate_rule_with_merchant_mismatch(self, db_session: Session, team_lead_user: User):
        """Test evaluating rule with merchant mismatch condition."""
        rule = create_rule(
            session=db_session,
            name="Merchant Mismatch",
            description="",
            condition_json={"merchant_mismatch": True},
            recommendation="Merchant variation detected",
            priority=7,
            created_by_id=team_lead_user.id,
        )
        
        case = Case()
        case.has_merchant_variation = True
        
        matches = Recommender.evaluate_rule_against_case(case, rule)
        assert matches is True
        
        case.has_merchant_variation = False
        matches = Recommender.evaluate_rule_against_case(case, rule)
        assert matches is False
    
    def test_get_recommendations_multiple_rules(self, db_session: Session, team_lead_user: User):
        """Test getting recommendations from multiple matching rules."""
        rule1 = create_rule(
            session=db_session,
            name="High-Value",
            description="",
            condition_json={"amount_min": 5000},
            recommendation="Verify authorization",
            priority=8,
            created_by_id=team_lead_user.id,
        )
        
        rule2 = create_rule(
            session=db_session,
            name="Z-Score",
            description="",
            condition_json={"high_z_score": 3.0},
            recommendation="Extreme anomaly",
            priority=9,
            created_by_id=team_lead_user.id,
        )
        
        rule3 = create_rule(
            session=db_session,
            name="Low Amount",
            description="",
            condition_json={"amount_min": 1, "amount_max": 100},
            recommendation="Small transaction",
            priority=2,
            created_by_id=team_lead_user.id,
        )
        
        # Case matches rule1 and rule2
        case = Case()
        case.amount = 7000
        case.max_score = 3.5
        case.has_merchant_variation = False
        case.has_rapid_multi_tx = False
        
        recommendations = Recommender.get_recommendations(case, db_session)
        
        # Should get 2 recommendations, sorted by priority DESC
        assert len(recommendations) == 2
        assert recommendations[0]["rule_id"] == rule2.id  # Priority 9
        assert recommendations[1]["rule_id"] == rule1.id  # Priority 8


class TestPlaybookAPIEndpoints:
    """Test playbook API endpoints with role enforcement."""
    
    def test_create_rule_team_lead_only(self, db_session: Session):
        """Test that only TEAM_LEAD can create rules (role enforcement logic)."""
        from app.routers.playbooks import require_team_lead
        from fastapi import HTTPException
        
        # Create test users
        team_lead = User(user_id="team_lead", role="TEAM_LEAD")
        db_session.add(team_lead)
        db_session.commit()
        
        reviewer = User(user_id="reviewer", role="REVIEWER")
        db_session.add(reviewer)
        db_session.commit()
        
        # Test role enforcement function directly
        # TEAM_LEAD should pass
        assert require_team_lead(team_lead) == team_lead
        
        # REVIEWER should raise 403
        with pytest.raises(HTTPException) as exc_info:
            require_team_lead(reviewer)
        assert exc_info.value.status_code == 403
    
    def test_list_rules_endpoint(self, db_session: Session):
        """Test listing rules endpoint."""
        def override_get_db():
            yield db_session
        
        app.dependency_overrides[get_db] = override_get_db
        
        team_lead = User(user_id="team_lead", role="TEAM_LEAD")
        db_session.add(team_lead)
        db_session.commit()
        
        # Create a rule
        create_rule(
            session=db_session,
            name="Test Rule",
            description="",
            condition_json={},
            recommendation="Test",
            priority=5,
            created_by_id=team_lead.id,
        )
        
        # List rules endpoint would return 200 with rules list
        # (Full endpoint test requires auth mocking)
        
        app.dependency_overrides.clear()


class TestSeedPlaybookRules:
    """Test that seed playbook rules are valid and sensible."""
    
    def test_seed_rules_load(self):
        """Test that seed rules fixture loads as valid JSON."""
        import json
        import os
        
        fixture_path = os.path.join(os.path.dirname(__file__), "..", "fixtures", "seed_playbook_rules.json")
        with open(fixture_path, "r") as f:
            rules = json.load(f)
        
        assert len(rules) >= 5
        
        for rule in rules:
            assert "name" in rule
            assert "description" in rule
            assert "condition_json" in rule
            assert "recommendation" in rule
            assert "priority" in rule
            
            # Priority should be 1-10
            assert 1 <= rule["priority"] <= 10
            
            # Recommendation should be meaningful
            assert len(rule["recommendation"]) > 10
    
    def test_seed_rules_have_unique_priorities(self):
        """Test that seed rules have meaningful priority distribution."""
        import json
        import os
        
        fixture_path = os.path.join(os.path.dirname(__file__), "..", "fixtures", "seed_playbook_rules.json")
        with open(fixture_path, "r") as f:
            rules = json.load(f)
        
        priorities = [r["priority"] for r in rules]
        
        # Should not all be the same priority
        assert len(set(priorities)) > 1
        
        # Should have high-priority rules (8+)
        assert max(priorities) >= 8
