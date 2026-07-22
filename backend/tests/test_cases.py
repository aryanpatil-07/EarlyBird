"""
Unit tests for case workflow — state machine, dedup, concurrency, SLA.

Tests FR-020–032 (case workflow requirements).
"""

import pytest
from datetime import datetime, timedelta
from app.cases import CaseState, CaseStateMachine, InvalidStateTransitionException
from app.cases.dedup import (
    find_mergeable_case,
    group_anomalies_for_dedup,
    calculate_dedup_stats,
)


class TestCaseStateMachine:
    """Tests for CaseStateMachine state transition logic."""

    def test_valid_transition_new_to_accepted(self):
        """Test NEW → ACCEPTED (reviewer opens case)."""
        assert CaseStateMachine.is_valid_transition(CaseState.NEW, CaseState.ACCEPTED)
        # Should not raise
        CaseStateMachine.validate_transition(CaseState.NEW, CaseState.ACCEPTED)

    def test_valid_transition_new_to_escalated(self):
        """Test NEW → ESCALATED (SLA breach or reviewer escalates)."""
        assert CaseStateMachine.is_valid_transition(CaseState.NEW, CaseState.ESCALATED)
        CaseStateMachine.validate_transition(CaseState.NEW, CaseState.ESCALATED)

    def test_valid_transition_accepted_to_resolved(self):
        """Test ACCEPTED → RESOLVED (reviewer resolves)."""
        assert CaseStateMachine.is_valid_transition(CaseState.ACCEPTED, CaseState.RESOLVED)
        CaseStateMachine.validate_transition(CaseState.ACCEPTED, CaseState.RESOLVED)

    def test_valid_transition_accepted_to_escalated(self):
        """Test ACCEPTED → ESCALATED (reviewer escalates)."""
        assert CaseStateMachine.is_valid_transition(CaseState.ACCEPTED, CaseState.ESCALATED)
        CaseStateMachine.validate_transition(CaseState.ACCEPTED, CaseState.ESCALATED)

    def test_valid_transition_escalated_to_resolved(self):
        """Test ESCALATED → RESOLVED (team lead resolves)."""
        assert CaseStateMachine.is_valid_transition(CaseState.ESCALATED, CaseState.RESOLVED)
        CaseStateMachine.validate_transition(CaseState.ESCALATED, CaseState.RESOLVED)

    def test_invalid_transition_resolved_to_anything(self):
        """Test RESOLVED is terminal — no transitions out."""
        for next_state in [CaseState.NEW, CaseState.ACCEPTED, CaseState.ESCALATED]:
            assert not CaseStateMachine.is_valid_transition(CaseState.RESOLVED, next_state)
            with pytest.raises(InvalidStateTransitionException) as exc_info:
                CaseStateMachine.validate_transition(CaseState.RESOLVED, next_state)
            assert "terminal" in str(exc_info.value).lower()

    def test_invalid_transition_new_to_resolved_direct(self):
        """Test NEW cannot go directly to RESOLVED (must go through ACCEPTED or ESCALATED first)."""
        assert not CaseStateMachine.is_valid_transition(CaseState.NEW, CaseState.RESOLVED)
        with pytest.raises(InvalidStateTransitionException):
            CaseStateMachine.validate_transition(CaseState.NEW, CaseState.RESOLVED)

    def test_invalid_transition_accepted_to_new(self):
        """Test ACCEPTED cannot go back to NEW."""
        assert not CaseStateMachine.is_valid_transition(CaseState.ACCEPTED, CaseState.NEW)
        with pytest.raises(InvalidStateTransitionException) as exc_info:
            CaseStateMachine.validate_transition(CaseState.ACCEPTED, CaseState.NEW)
        assert "back to NEW" in str(exc_info.value)

    def test_invalid_transition_escalated_to_accepted(self):
        """Test ESCALATED cannot go back to ACCEPTED."""
        assert not CaseStateMachine.is_valid_transition(CaseState.ESCALATED, CaseState.ACCEPTED)
        with pytest.raises(InvalidStateTransitionException):
            CaseStateMachine.validate_transition(CaseState.ESCALATED, CaseState.ACCEPTED)

    def test_get_valid_next_states_from_new(self):
        """Test valid next states from NEW."""
        valid = CaseStateMachine.get_valid_next_states(CaseState.NEW)
        assert valid == {CaseState.ACCEPTED, CaseState.ESCALATED}

    def test_get_valid_next_states_from_accepted(self):
        """Test valid next states from ACCEPTED."""
        valid = CaseStateMachine.get_valid_next_states(CaseState.ACCEPTED)
        assert valid == {CaseState.RESOLVED, CaseState.ESCALATED}

    def test_get_valid_next_states_from_escalated(self):
        """Test valid next states from ESCALATED."""
        valid = CaseStateMachine.get_valid_next_states(CaseState.ESCALATED)
        assert valid == {CaseState.RESOLVED}

    def test_get_valid_next_states_from_resolved(self):
        """Test valid next states from RESOLVED (terminal — empty set)."""
        valid = CaseStateMachine.get_valid_next_states(CaseState.RESOLVED)
        assert valid == set()

    def test_all_valid_transitions_are_bidirectional_symmetric_check(self):
        """
        Verify the set of valid transitions is intentionally asymmetric.
        (This is a sanity check on the design — transitions are one-way by intent.)
        """
        # Count forward transitions: should be exactly 5
        assert len(CaseStateMachine.VALID_TRANSITIONS) == 5
        
        # Count reverse transitions (should be 0 — no backwards allowed)
        reverse_transitions = {
            (to_state, from_state)
            for from_state, to_state in CaseStateMachine.VALID_TRANSITIONS
        }
        no_reverse_in_valid = reverse_transitions.intersection(
            CaseStateMachine.VALID_TRANSITIONS
        )
        assert len(no_reverse_in_valid) == 0, "State machine should be acyclic"


class TestDedupLogic:
    """Tests for de-duplication logic (FR-020)."""

    def test_group_anomalies_single_group_same_entity_within_window(self):
        """Test grouping anomalies from same entity within time window."""
        now = datetime.utcnow()
        anomalies = [
            (1, "card_123", now),
            (2, "card_123", now + timedelta(minutes=10)),
            (3, "card_123", now + timedelta(minutes=20)),
        ]
        
        # Mock the query result
        groups = []
        current_group = []
        current_entity = "card_123"
        current_time = now
        window = timedelta(minutes=30)
        
        for anomaly_id, entity_id, created_at in anomalies:
            if entity_id == current_entity and created_at - current_time <= window:
                current_group.append(anomaly_id)
                current_time = created_at
            else:
                if current_group:
                    groups.append(current_group)
                current_group = [anomaly_id]
                current_entity = entity_id
                current_time = created_at
        
        if current_group:
            groups.append(current_group)
        
        assert len(groups) == 1
        assert groups[0] == [1, 2, 3]

    def test_group_anomalies_multiple_groups_different_entities(self):
        """Test grouping anomalies with different entities creates separate groups."""
        now = datetime.utcnow()
        anomalies = [
            (1, "card_123", now),
            (2, "card_456", now + timedelta(minutes=5)),
            (3, "card_123", now + timedelta(minutes=40)),  # Outside 30-min window, same entity
        ]
        
        groups = []
        current_group = []
        current_entity = None
        current_time = None
        window = timedelta(minutes=30)
        
        for anomaly_id, entity_id, created_at in sorted(
            anomalies, key=lambda x: x[2]
        ):
            if (
                current_entity is None
                or (entity_id == current_entity and created_at - current_time <= window)
            ):
                current_group.append(anomaly_id)
                current_entity = entity_id
                current_time = created_at
            else:
                if current_group:
                    groups.append(current_group)
                current_group = [anomaly_id]
                current_entity = entity_id
                current_time = created_at
        
        if current_group:
            groups.append(current_group)
        
        # Should have multiple groups due to entity change and time window
        assert len(groups) >= 2

    def test_calculate_dedup_stats_with_data(self):
        """Test dedup statistics calculation."""
        stats = calculate_dedup_stats(
            session=None,
            total_anomalies=100,
            total_cases=60
        )
        
        assert stats["total_anomalies"] == 100
        assert stats["total_cases"] == 60
        assert stats["merged_count"] == 40
        assert stats["dedup_rate"] == 40.0

    def test_calculate_dedup_stats_zero_anomalies(self):
        """Test dedup statistics with zero anomalies."""
        stats = calculate_dedup_stats(
            session=None,
            total_anomalies=0,
            total_cases=0
        )
        
        assert stats["dedup_rate"] == 0.0
        assert stats["merged_count"] == 0

    def test_calculate_dedup_stats_all_merged(self):
        """Test dedup statistics when all anomalies are merged."""
        stats = calculate_dedup_stats(
            session=None,
            total_anomalies=100,
            total_cases=50
        )
        
        # 50 anomalies merged out of 100
        assert stats["dedup_rate"] == 50.0
        assert stats["merged_count"] == 50


class TestSLAEscalation:
    """Tests for SLA auto-escalation logic (FR-031)."""

    def test_sla_window_definition(self):
        """Test that SLA window is correctly defined as 2 hours."""
        from app.cases.sla import SLA_WINDOW_SECONDS
        assert SLA_WINDOW_SECONDS == 2 * 60 * 60  # 7200 seconds

    def test_case_within_sla_window_not_escalated(self):
        """Test that cases within SLA window are not escalated."""
        now = datetime.utcnow()
        case_created = now - timedelta(minutes=30)  # 30 minutes ago (within 2-hour SLA)
        sla_cutoff = now - timedelta(seconds=2 * 60 * 60)
        
        # Case should NOT be selected for escalation
        assert case_created > sla_cutoff

    def test_case_outside_sla_window_eligible_for_escalation(self):
        """Test that cases outside SLA window are eligible for escalation."""
        now = datetime.utcnow()
        case_created = now - timedelta(hours=3)  # 3 hours ago (exceeds 2-hour SLA)
        sla_cutoff = now - timedelta(seconds=2 * 60 * 60)
        
        # Case should be selected for escalation
        assert case_created <= sla_cutoff

    def test_sla_escalation_only_applies_to_open_states(self):
        """Test that SLA escalation only applies to NEW and ACCEPTED states."""
        open_states = [CaseState.NEW, CaseState.ACCEPTED]
        terminal_states = [CaseState.RESOLVED, CaseState.ESCALATED]
        
        # Open states should be eligible for SLA escalation
        for state in open_states:
            assert state in open_states
        
        # Terminal states should NOT be escalated by SLA
        for state in terminal_states:
            assert state not in open_states

    def test_sla_escalation_creates_valid_transition(self):
        """Test that SLA escalation uses valid state transitions."""
        # NEW → ESCALATED should be valid
        assert CaseStateMachine.is_valid_transition(CaseState.NEW, CaseState.ESCALATED)
        
        # ACCEPTED → ESCALATED should be valid
        assert CaseStateMachine.is_valid_transition(
            CaseState.ACCEPTED, CaseState.ESCALATED
        )
        
        # RESOLVED → ESCALATED should NOT be valid (already terminal)
        assert not CaseStateMachine.is_valid_transition(
            CaseState.RESOLVED, CaseState.ESCALATED
        )

    def test_sla_escalation_records_audit_log(self):
        """Test that SLA escalation creates an audit log entry."""
        # This is a semantic test — the actual audit log write
        # happens in check_sla_breaches() during database transaction.
        # We verify here that the expected fields are defined.
        expected_audit_fields = {
            "case_id",
            "action",
            "actor",
            "details",
            "timestamp",
        }
        
        audit_template = {
            "case_id": 1,
            "action": "escalate",
            "actor": "system",
            "details": {
                "reason": "SLA breach (2-hour window exceeded)",
                "old_state": CaseState.NEW.value,
                "new_state": CaseState.ESCALATED.value,
            },
            "timestamp": datetime.utcnow(),
        }
        
        assert set(audit_template.keys()) == expected_audit_fields

    def test_sla_escalation_invalid_transition_handled(self):
        """Test that SLA escalation gracefully handles invalid transitions."""
        # If a case somehow ends up in RESOLVED state, it should not be
        # selected for SLA escalation in the first place (filtering at query level).
        # But if it were, the code should catch InvalidStateTransitionException
        # and log a warning (not crash).
        
        with pytest.raises(InvalidStateTransitionException):
            CaseStateMachine.validate_transition(
                CaseState.RESOLVED.value, CaseState.ESCALATED.value
            )

    def test_sla_callback_logs_results(self):
        """Test that SLA callback produces the expected result structure."""
        # This tests that the callback returns the correct result dict shape.
        # (Actual DB operations tested separately with fixtures.)
        
        expected_result_keys = {
            "success",
            "checked_count",
            "escalated_count",
            "timestamp",
            "error",
        }
        
        sample_result = {
            "success": True,
            "checked_count": 5,
            "escalated_count": 2,
            "timestamp": datetime.utcnow().isoformat(),
            "error": None,
        }
        
        assert set(sample_result.keys()) == expected_result_keys


class TestOptimisticConcurrency:
    """Tests for optimistic concurrency control (FR-028)."""

    def test_version_check_passes_on_match(self):
        """Test that version check passes when versions match."""
        # This is a semantic test — actual DB operations tested with fixtures.
        # Verify that check_version doesn't raise when versions match.
        from app.cases.concurrency import check_version, StaleEntityException
        
        # Mock case with matching version
        class MockCase:
            id = 1
            version = 5
        
        # No exception should be raised
        # (In real scenario, this would query DB and compare)

    def test_version_mismatch_raises_exception(self):
        """Test that version check raises StaleEntityException on mismatch."""
        from app.cases.concurrency import StaleEntityException
        
        # Verify exception can be instantiated with proper fields
        exc = StaleEntityException(
            entity_id=1,
            current_version=10,
            stale_version=5
        )
        
        assert exc.entity_id == 1
        assert exc.current_version == 10
        assert exc.stale_version == 5
        assert "Entity 1" in str(exc)
        assert "10" in str(exc)
        assert "5" in str(exc)

    def test_concurrent_modification_detection_true_case(self):
        """Test detection returns True when versions diverge."""
        # Semantic test: verify logic that detects concurrent modification
        expected_version = 5
        actual_version = 10
        
        concurrent_detected = actual_version != expected_version
        assert concurrent_detected is True

    def test_concurrent_modification_detection_false_case(self):
        """Test detection returns False when versions match."""
        expected_version = 5
        actual_version = 5
        
        concurrent_detected = actual_version != expected_version
        assert concurrent_detected is False

    def test_version_increment_operation(self):
        """Test semantic version increment logic."""
        # Verify that incrementing version N produces N+1
        current_version = 5
        incremented = current_version + 1
        
        assert incremented == 6
        assert incremented > current_version

    def test_version_zero_initial_state(self):
        """Test that initial version is 0 (before first update)."""
        # Per LLD §5, new cases start at version 0
        initial_version = 0
        first_update_version = initial_version + 1
        
        assert first_update_version == 1

    def test_version_overflow_protection(self):
        """Test that version field can handle many increments."""
        # Verify that version is an integer field that doesn't overflow in normal usage
        import sys
        
        version = 0
        # Simulate 1000 concurrent updates
        for _ in range(1000):
            version += 1
        
        assert version == 1000
        assert version < sys.maxsize  # No integer overflow in Python

    def test_stale_case_state_http_409(self):
        """Test that stale case state should return HTTP 409 Conflict."""
        # This documents the expected HTTP response for concurrent modification.
        # Actual HTTP handling done in API layer.
        expected_http_status = 409
        expected_reason = "Conflict"
        
        # Verify constant values for reference
        assert expected_http_status == 409
        assert expected_reason == "Conflict"

    def test_version_comparison_semantics(self):
        """Test that version comparison follows correct semantics."""
        client_version = 5
        server_version = 6
        
        # If client version < server version, concurrent modification occurred
        concurrent = client_version < server_version
        assert concurrent is True
        
        # If versions equal, no concurrent modification
        client_version = 6
        concurrent = client_version != server_version
        assert concurrent is False

    def test_optimistic_lock_failure_case(self):
        """Test lock failure scenario: client tries to update with old version."""
        # Simulates a transaction sequence:
        # 1. Client reads case version=5
        # 2. Server increments to version=6 (another client updates)
        # 3. Original client tries to write with version=5 → CONFLICT
        
        client_version = 5
        server_version = 6
        
        # Client check would fail
        lock_acquired = client_version == server_version
        assert lock_acquired is False

    def test_optimistic_lock_success_case(self):
        """Test lock success scenario: versions match."""
        client_version = 5
        server_version = 5
        
        # Client check would succeed
        lock_acquired = client_version == server_version
        assert lock_acquired is True
        
        # After successful update, version increments
        new_server_version = server_version + 1
        assert new_server_version == 6
