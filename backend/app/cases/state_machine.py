"""
Case State Machine — Define valid canonical states and transitions.

Canonical states per PRD/UX:
  NEW -> ACKNOWLEDGED -> RESOLVED
  NEW / ACKNOWLEDGED -> ESCALATED -> RESOLVED
"""

from enum import Enum
from typing import Set, Tuple


class CaseState(str, Enum):
    """Valid case states per canonical specification."""
    NEW = "NEW"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    ACCEPTED = "ACCEPTED"  # Backward compatibility alias for ACKNOWLEDGED
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
    Enforces case state transitions per canonical state diagram.
    
    Valid transitions:
      - NEW → ACKNOWLEDGED (or ACCEPTED)
      - NEW → ESCALATED (SLA breach or reviewer escalation)
      - ACKNOWLEDGED/ACCEPTED → RESOLVED (reviewer resolves)
      - ACKNOWLEDGED/ACCEPTED → ESCALATED (reviewer escalates)
      - ESCALATED → RESOLVED (team lead resolves)
      - RESOLVED is terminal (no transitions out)
    """

    VALID_TRANSITIONS: Set[Tuple[str, str]] = {
        (CaseState.NEW.value, CaseState.ACKNOWLEDGED.value),
        (CaseState.NEW.value, CaseState.ACCEPTED.value),
        (CaseState.NEW.value, CaseState.ESCALATED.value),
        (CaseState.ACKNOWLEDGED.value, CaseState.RESOLVED.value),
        (CaseState.ACKNOWLEDGED.value, CaseState.ESCALATED.value),
        (CaseState.ACCEPTED.value, CaseState.RESOLVED.value),
        (CaseState.ACCEPTED.value, CaseState.ESCALATED.value),
        (CaseState.ESCALATED.value, CaseState.RESOLVED.value),
    }

    @staticmethod
    def is_valid_transition(current_state: str, next_state: str) -> bool:
        return (current_state, next_state) in CaseStateMachine.VALID_TRANSITIONS

    @staticmethod
    def validate_transition(current_state: str, next_state: str) -> str:
        if not CaseStateMachine.is_valid_transition(current_state, next_state):
            reason = ""
            if current_state == CaseState.RESOLVED.value:
                reason = "RESOLVED is terminal; no transitions allowed out of it."
            elif next_state == CaseState.NEW.value:
                reason = "Cannot transition back to NEW from any other state."
            raise InvalidStateTransitionException(current_state, next_state, reason)
        return next_state

    @staticmethod
    def get_valid_next_states(current_state: str) -> Set[str]:
        return {
            next_state
            for from_state, next_state in CaseStateMachine.VALID_TRANSITIONS
            if from_state == current_state
        }
