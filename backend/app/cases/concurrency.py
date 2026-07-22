"""
Optimistic concurrency control for Case updates.

Implements version column checks to detect concurrent modifications.
Returns 409 CONFLICT if case has been modified since client read.
(LLD §5, FR-028)
"""

from sqlalchemy.orm import Session
from app.models import Case
import logging

logger = logging.getLogger(__name__)


class StaleEntityException(Exception):
    """Raised when attempting to update an entity with stale version."""
    def __init__(self, entity_id: int, current_version: int, stale_version: int):
        self.entity_id = entity_id
        self.current_version = current_version
        self.stale_version = stale_version
        super().__init__(
            f"Entity {entity_id} has been modified. "
            f"Your version: {stale_version}, Current version: {current_version}"
        )


def check_version(db: Session, case_id: int, client_version: int) -> None:
    """
    Verify that client version matches current case version.
    
    Args:
        db: SQLAlchemy session
        case_id: ID of case to check
        client_version: Version number from client request
        
    Raises:
        StaleEntityException if versions don't match
        ValueError if case not found
    """
    case = db.query(Case).filter(Case.id == case_id).first()
    
    if case is None:
        raise ValueError(f"Case {case_id} not found")
    
    if case.version != client_version:
        raise StaleEntityException(
            entity_id=case_id,
            current_version=case.version,
            stale_version=client_version
        )


def increment_version(db: Session, case_id: int) -> int:
    """
    Increment case version for optimistic concurrency.
    
    Args:
        db: SQLAlchemy session
        case_id: ID of case to update
        
    Returns:
        New version number
        
    Raises:
        ValueError if case not found
    """
    case = db.query(Case).filter(Case.id == case_id).first()
    
    if case is None:
        raise ValueError(f"Case {case_id} not found")
    
    case.version += 1
    db.add(case)
    # Don't commit here — let caller decide when to commit
    
    return case.version


def detect_concurrent_modification(
    db: Session,
    case_id: int,
    expected_version: int
) -> bool:
    """
    Detect if case has been modified concurrently.
    
    Args:
        db: SQLAlchemy session
        case_id: ID of case
        expected_version: Version number expected by caller
        
    Returns:
        True if concurrent modification detected (versions don't match), False otherwise
    """
    case = db.query(Case).filter(Case.id == case_id).first()
    
    if case is None:
        return False
    
    return case.version != expected_version
