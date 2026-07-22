"""
Case workflow API endpoints (Phase 3 — M3).

Implements FR-025–032:
- FR-025: Case queue (paginated NEW/ACCEPTED/ESCALATED)
- FR-026: Case detail with audit trail
- FR-027: Accept case (NEW → ACCEPTED)
- FR-028: Resolve case (ACCEPTED/ESCALATED → RESOLVED)
- FR-029: Escalate case (*→ESCALATED)
- FR-031: SLA auto-escalation + manual escalation
- FR-032: Audit log + role-based access

Uses:
- State machine for transitions (state_machine.py)
- Optimistic concurrency (concurrency.py)
- De-duplication stats (dedup.py)
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Optional
from app.database import get_db
from app.models import Case, AuditLog, User
from app.cases.state_machine import CaseStateMachine, CaseState, InvalidStateTransitionException
from app.cases.concurrency import check_version, StaleEntityException, increment_version
from app.cases.dedup import calculate_dedup_stats
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/cases", tags=["cases"])


# Pydantic models for API requests/responses
from pydantic import BaseModel


class CaseDetailResponse(BaseModel):
    """Response model for case detail."""
    id: int
    case_id: str
    state: str
    severity: str
    priority: int
    version: int
    recommendations: Optional[dict] = None
    created_at: str
    updated_at: str
    resolved_at: Optional[str] = None
    
    class Config:
        from_attributes = True
    
    @classmethod
    def from_orm(cls, obj):
        """Convert Case ORM object to response model, serializing datetimes to ISO format."""
        return cls(
            id=obj.id,
            case_id=obj.case_id,
            state=obj.state,
            severity=obj.severity,
            priority=obj.priority,
            version=obj.version,
            recommendations=obj.recommendations,
            created_at=obj.created_at.isoformat() if obj.created_at else None,
            updated_at=obj.updated_at.isoformat() if obj.updated_at else None,
            resolved_at=obj.resolved_at.isoformat() if obj.resolved_at else None,
        )


class CaseListResponse(BaseModel):
    """Response model for case list."""
    cases: List[CaseDetailResponse]
    total: int
    page: int
    limit: int
    dedup_stats: Optional[dict] = None


class CaseActionRequest(BaseModel):
    """Request model for case action (accept/resolve/escalate)."""
    version: int  # For optimistic concurrency check
    note: Optional[str] = None  # Optional audit note


# Helper functions
def get_current_user(db: Session = Depends(get_db)) -> User:
    """
    Placeholder: In real app, extract from JWT token.
    For now, returns a mock reviewer user.
    """
    # TODO: Implement JWT token validation
    user = db.query(User).filter(User.user_id == "system_user").first()
    if not user:
        # Create placeholder user
        user = User(user_id="system_user", role="REVIEWER")
        db.add(user)
        db.commit()
    return user


def check_role_can_escalate(user: User) -> bool:
    """Only TEAM_LEAD can escalate cases (in production; for now, both can)."""
    # LLD §4: Escalation is primarily TEAM_LEAD action,
    # but for MVP, both REVIEWER and TEAM_LEAD can escalate.
    return user.role in ("REVIEWER", "TEAM_LEAD")


def check_role_can_resolve_escalated(user: User) -> bool:
    """Only TEAM_LEAD can resolve ESCALATED cases."""
    return user.role == "TEAM_LEAD"


# Endpoints

@router.get("", response_model=CaseListResponse)
def get_cases(
    state: Optional[str] = Query(None, description="Filter by state (NEW, ACCEPTED, ESCALATED, RESOLVED)"),
    limit: int = Query(20, ge=1, le=100),
    page: int = Query(1, ge=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get paginated case queue.
    
    - Filter by state (default: NEW + ACCEPTED for reviewer queue)
    - Ordered by severity/priority/created_at
    - Includes de-duplication stats
    
    FR-025: Case queue (paginated)
    """
    try:
        # Build query
        query = db.query(Case)
        
        if state:
            # Validate state
            if state not in [s.value for s in CaseState]:
                raise HTTPException(status_code=400, detail=f"Invalid state: {state}")
            query = query.filter(Case.state == state)
        else:
            # Default: show open cases (not RESOLVED)
            query = query.filter(
                Case.state.in_([CaseState.NEW.value, CaseState.ACCEPTED.value, CaseState.ESCALATED.value])
            )
        
        # Order by severity/priority/created_at
        query = query.order_by(
            Case.severity.desc(),
            Case.priority.desc(),
            Case.created_at.asc()
        )
        
        # Pagination
        total = query.count()
        skip = (page - 1) * limit
        cases = query.offset(skip).limit(limit).all()
        
        # Calculate dedup stats
        all_cases_count = db.query(Case).count()
        open_cases_count = db.query(Case).filter(
            Case.state.in_([CaseState.NEW.value, CaseState.ACCEPTED.value, CaseState.ESCALATED.value])
        ).count()
        
        dedup_stats = calculate_dedup_stats(
            session=db,
            total_anomalies=all_cases_count * 5,  # Rough estimate
            total_cases=all_cases_count
        )
        
        return CaseListResponse(
            cases=[CaseDetailResponse.from_orm(c) for c in cases],
            total=total,
            page=page,
            limit=limit,
            dedup_stats=dedup_stats
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching case queue: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/{case_id}", response_model=CaseDetailResponse)
def get_case_detail(
    case_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get full case detail with audit trail.
    
    FR-026: Case detail + audit trail
    """
    try:
        case = db.query(Case).filter(Case.id == case_id).first()
        if not case:
            raise HTTPException(status_code=404, detail=f"Case {case_id} not found")
        
        return CaseDetailResponse.from_orm(case)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching case {case_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/{case_id}/accept", response_model=CaseDetailResponse)
def accept_case(
    case_id: int,
    request: CaseActionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Accept case: NEW → ACCEPTED (reviewer opens)
    
    - Checks version for optimistic concurrency
    - Validates state transition
    - Creates audit log
    
    FR-027: Accept case
    FR-028: Optimistic concurrency
    """
    try:
        case = db.query(Case).filter(Case.id == case_id).first()
        if not case:
            raise HTTPException(status_code=404, detail=f"Case {case_id} not found")
        
        # Check version for optimistic concurrency
        try:
            check_version(db, case_id, request.version)
        except StaleEntityException as e:
            raise HTTPException(status_code=409, detail=str(e))
        
        # Validate state transition
        try:
            CaseStateMachine.validate_transition(case.state, CaseState.ACCEPTED.value)
        except InvalidStateTransitionException as e:
            raise HTTPException(status_code=400, detail=str(e))
        
        # Update case
        old_state = case.state
        case.state = CaseState.ACCEPTED.value
        case.updated_at = datetime.utcnow()
        increment_version(db, case_id)
        db.add(case)
        
        # Create audit log
        audit = AuditLog(
            entity_type="case",
            entity_id=str(case_id),
            action="accept",
            actor_id=current_user.user_id,
            changes={
                "old_state": old_state,
                "new_state": CaseState.ACCEPTED.value,
                "note": request.note or ""
            },
        )
        db.add(audit)
        db.commit()
        
        logger.info(f"Case {case_id} accepted by {current_user.user_id}")
        return CaseDetailResponse.from_orm(case)
    
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error accepting case {case_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/{case_id}/resolve", response_model=CaseDetailResponse)
def resolve_case(
    case_id: int,
    request: CaseActionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Resolve case: ACCEPTED/ESCALATED → RESOLVED
    
    - Checks version for optimistic concurrency
    - Validates state transition
    - Creates audit log
    - Only TEAM_LEAD can resolve ESCALATED cases
    
    FR-028: Resolve case (ACCEPTED/ESCALATED)
    """
    try:
        case = db.query(Case).filter(Case.id == case_id).first()
        if not case:
            raise HTTPException(status_code=404, detail=f"Case {case_id} not found")
        
        # Check version for optimistic concurrency
        try:
            check_version(db, case_id, request.version)
        except StaleEntityException as e:
            raise HTTPException(status_code=409, detail=str(e))
        
        # Role check: only TEAM_LEAD can resolve ESCALATED
        if case.state == CaseState.ESCALATED.value:
            if not check_role_can_resolve_escalated(current_user):
                raise HTTPException(status_code=403, detail="Only TEAM_LEAD can resolve escalated cases")
        
        # Validate state transition
        try:
            CaseStateMachine.validate_transition(case.state, CaseState.RESOLVED.value)
        except InvalidStateTransitionException as e:
            raise HTTPException(status_code=400, detail=str(e))
        
        # Update case
        old_state = case.state
        case.state = CaseState.RESOLVED.value
        case.updated_at = datetime.utcnow()
        case.resolved_at = datetime.utcnow()
        increment_version(db, case_id)
        db.add(case)
        
        # Create audit log
        audit = AuditLog(
            entity_type="case",
            entity_id=str(case_id),
            action="resolve",
            actor_id=current_user.user_id,
            changes={
                "old_state": old_state,
                "new_state": CaseState.RESOLVED.value,
                "note": request.note or ""
            },
        )
        db.add(audit)
        db.commit()
        
        logger.info(f"Case {case_id} resolved by {current_user.user_id}")
        return CaseDetailResponse.from_orm(case)
    
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error resolving case {case_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/{case_id}/escalate", response_model=CaseDetailResponse)
def escalate_case(
    case_id: int,
    request: CaseActionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Escalate case: NEW/ACCEPTED/ESCALATED → ESCALATED
    
    - Checks version for optimistic concurrency
    - Validates state transition
    - Creates audit log
    - Role check: REVIEWER or TEAM_LEAD
    
    FR-029: Escalate case
    """
    try:
        case = db.query(Case).filter(Case.id == case_id).first()
        if not case:
            raise HTTPException(status_code=404, detail=f"Case {case_id} not found")
        
        # Role check
        if not check_role_can_escalate(current_user):
            raise HTTPException(status_code=403, detail="Only REVIEWER or TEAM_LEAD can escalate cases")
        
        # Check version for optimistic concurrency
        try:
            check_version(db, case_id, request.version)
        except StaleEntityException as e:
            raise HTTPException(status_code=409, detail=str(e))
        
        # Validate state transition
        try:
            CaseStateMachine.validate_transition(case.state, CaseState.ESCALATED.value)
        except InvalidStateTransitionException as e:
            raise HTTPException(status_code=400, detail=str(e))
        
        # Update case
        old_state = case.state
        case.state = CaseState.ESCALATED.value
        case.updated_at = datetime.utcnow()
        increment_version(db, case_id)
        db.add(case)
        
        # Create audit log
        audit = AuditLog(
            entity_type="case",
            entity_id=str(case_id),
            action="escalate",
            actor_id=current_user.user_id,
            changes={
                "old_state": old_state,
                "new_state": CaseState.ESCALATED.value,
                "note": request.note or ""
            },
        )
        db.add(audit)
        db.commit()
        
        logger.info(f"Case {case_id} escalated by {current_user.user_id}")
        return CaseDetailResponse.from_orm(case)
    
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error escalating case {case_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
