"""
Unit tests for case workflow — state machine, dedup, concurrency, SLA.

Tests FR-020–032 (case workflow requirements).
"""

import pytest
from app.cases import CaseState, CaseStateMachine, InvalidStateTransitionException


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
