"""
Case State Machine — Define valid states and transitions.

Enforces FR-061 role-based access for escalation and FR-050 audit trail.
"""

from enum import Enum
from typing import Set, Tuple


class CaseState(str, Enum):
    """Valid case states per LLD §4."""
    NEW = "NEW"
    ACCEPTED = "ACCEPTED"
    RESOLVED = "RESOLVED"
    ESCALATED = "ESCALATED"


class InvalidStateTransitionException(Exception):
    """Raised when an invalid state transition is attempted."""
    def __init__(self, current_state: str, requested_state: str, reason: str = ""):
        self.current_state = current_state
        self.requested_state = requested_state
        self.reason = reason
        super().__init__(
            f"Invalid transition: {current_state} -> {requested_state}. {reason}"
        )


class CaseStateMachine:
    """
    Enforces case state transitions per LLD §4 state diagram.
    
    Valid transitions:
      - NEW → ACCEPTED (reviewer opens case)
      - NEW → ESCALATED (SLA breach or reviewer escalates)
      - ACCEPTED → RESOLVED (reviewer resolves)
      - ACCEPTED → ESCALATED (reviewer escalates)
      - ESCALATED → RESOLVED (team lead resolves)
      - RESOLVED is terminal (no transitions out)
    """

    # Define valid transitions as a set of (from_state, to_state) tuples
    VALID_TRANSITIONS: Set[Tuple[str, str]] = {
        (CaseState.NEW, CaseState.ACCEPTED),
        (CaseState.NEW, CaseState.ESCALATED),
        (CaseState.ACCEPTED, CaseState.RESOLVED),
        (CaseState.ACCEPTED, CaseState.ESCALATED),
        (CaseState.ESCALATED, CaseState.RESOLVED),
    }

    @staticmethod
    def is_valid_transition(current_state: str, next_state: str) -> bool:
        """
        Check if a transition is allowed.
        
        Args:
            current_state: Current state of the case
            next_state: Requested next state
            
        Returns:
            True if transition is valid, False otherwise
        """
        return (current_state, next_state) in CaseStateMachine.VALID_TRANSITIONS

    @staticmethod
    def validate_transition(current_state: str, next_state: str) -> None:
        """
        Validate a transition and raise exception if invalid.
        
        Args:
            current_state: Current state of the case
            next_state: Requested next state
            
        Raises:
            InvalidStateTransitionException if transition is not allowed
        """
        if not CaseStateMachine.is_valid_transition(current_state, next_state):
            reason = ""
            if current_state == CaseState.RESOLVED:
                reason = f"RESOLVED is terminal; no transitions out of it."
            elif next_state == CaseState.NEW:
                reason = "Cannot transition back to NEW from any other state."
            
            raise InvalidStateTransitionException(current_state, next_state, reason)

    @staticmethod
    def get_valid_next_states(current_state: str) -> Set[str]:
        """
        Return all valid next states from the current state.
        
        Args:
            current_state: Current state of the case
            
        Returns:
            Set of valid next states, or empty set if current_state is terminal
        """
        return {
            next_state
            for from_state, next_state in CaseStateMachine.VALID_TRANSITIONS
            if from_state == current_state
        }
