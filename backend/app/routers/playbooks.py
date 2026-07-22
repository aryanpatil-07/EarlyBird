"""API endpoints for playbook rule management and recommendations."""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.models import User, Case
from app.playbooks.rules import (
    PlaybookRule,
    create_rule,
    list_enabled_rules,
    get_rule_by_id,
    update_rule,
    disable_rule,
)
from app.playbooks.recommender import Recommender


router = APIRouter(prefix="/api", tags=["playbooks"])


# Helper: simple auth check
def get_current_user(authorization: str = None, db: Session = Depends(get_db)) -> User:
    """Get current user from Authorization header."""
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header",
        )
    
    try:
        scheme, token = authorization.split()
        if scheme.lower() != "bearer":
            raise ValueError("Invalid auth scheme")
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Authorization header format",
        )
    
    user = db.query(User).filter(User.user_id == token).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    return user


# Pydantic schemas

class PlaybookRuleCreate(BaseModel):
    """Schema for creating a playbook rule."""
    name: str
    description: Optional[str] = None
    condition_json: dict
    recommendation: str
    priority: int = 5


class PlaybookRuleUpdate(BaseModel):
    """Schema for updating a playbook rule."""
    name: Optional[str] = None
    description: Optional[str] = None
    condition_json: Optional[dict] = None
    recommendation: Optional[str] = None
    priority: Optional[int] = None


class PlaybookRuleResponse(BaseModel):
    """Schema for playbook rule response."""
    id: int
    name: str
    description: Optional[str]
    condition_json: dict
    recommendation: str
    priority: int
    enabled: int
    created_by_id: int
    created_at: str
    updated_at: str
    
    class Config:
        from_attributes = True


class RecommendationResponse(BaseModel):
    """Schema for recommendation response."""
    rule_id: int
    name: str
    recommendation: str
    priority: int


# Helpers

def require_team_lead(current_user: User = Depends(get_current_user)) -> User:
    """
    Dependency to enforce TEAM_LEAD role for write operations.
    
    Raises:
        HTTPException 403 if user is not TEAM_LEAD
    """
    if current_user.role != "TEAM_LEAD":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Team Lead can manage playbook rules",
        )
    return current_user


# Endpoints

@router.post("/playbook-rules", response_model=PlaybookRuleResponse)
def create_playbook_rule(
    rule_data: PlaybookRuleCreate,
    current_user: User = Depends(require_team_lead),
    db: Session = Depends(get_db),
) -> PlaybookRule:
    """
    Create a new playbook rule (TEAM_LEAD only).
    
    Args:
        rule_data: Rule creation payload
        current_user: Authenticated Team Lead user
        db: Database session
    
    Returns:
        Created PlaybookRule
    """
    rule = create_rule(
        session=db,
        name=rule_data.name,
        description=rule_data.description,
        condition_json=rule_data.condition_json,
        recommendation=rule_data.recommendation,
        priority=rule_data.priority,
        created_by_id=current_user.id,
    )
    return rule


@router.get("/playbook-rules", response_model=List[PlaybookRuleResponse])
def list_playbook_rules(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[PlaybookRule]:
    """
    List all enabled playbook rules.
    
    Accessible by any authenticated user (REVIEWER can see rules,
    only TEAM_LEAD can create/edit them).
    
    Args:
        current_user: Authenticated user
        db: Database session
    
    Returns:
        List of enabled PlaybookRules, sorted by priority DESC
    """
    return list_enabled_rules(db, order_by_priority=True)


@router.get("/playbook-rules/{rule_id}", response_model=PlaybookRuleResponse)
def get_playbook_rule(
    rule_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PlaybookRule:
    """
    Get a specific playbook rule by ID.
    
    Args:
        rule_id: Rule ID
        current_user: Authenticated user
        db: Database session
    
    Returns:
        PlaybookRule if found
    
    Raises:
        HTTPException 404 if rule not found
    """
    rule = get_rule_by_id(db, rule_id)
    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Playbook rule {rule_id} not found",
        )
    return rule


@router.put("/playbook-rules/{rule_id}", response_model=PlaybookRuleResponse)
def update_playbook_rule(
    rule_id: int,
    rule_data: PlaybookRuleUpdate,
    current_user: User = Depends(require_team_lead),
    db: Session = Depends(get_db),
) -> PlaybookRule:
    """
    Update a playbook rule (TEAM_LEAD only).
    
    Args:
        rule_id: Rule ID to update
        rule_data: Update payload (partial)
        current_user: Authenticated Team Lead user
        db: Database session
    
    Returns:
        Updated PlaybookRule
    
    Raises:
        HTTPException 404 if rule not found
    """
    rule = update_rule(
        session=db,
        rule_id=rule_id,
        name=rule_data.name,
        description=rule_data.description,
        condition_json=rule_data.condition_json,
        recommendation=rule_data.recommendation,
        priority=rule_data.priority,
    )
    
    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Playbook rule {rule_id} not found",
        )
    
    return rule


@router.delete("/playbook-rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_playbook_rule(
    rule_id: int,
    current_user: User = Depends(require_team_lead),
    db: Session = Depends(get_db),
) -> None:
    """
    Soft-delete a playbook rule by setting enabled=0 (TEAM_LEAD only).
    
    Args:
        rule_id: Rule ID to delete
        current_user: Authenticated Team Lead user
        db: Database session
    
    Raises:
        HTTPException 404 if rule not found
    """
    rule = disable_rule(db, rule_id)
    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Playbook rule {rule_id} not found",
        )


@router.get("/cases/{case_id}/recommendations", response_model=List[RecommendationResponse])
def get_case_recommendations(
    case_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[dict]:
    """
    Get all matching recommendations for a case.
    
    Evaluates all enabled playbook rules against the case and returns
    matching recommendations sorted by priority (highest first).
    
    Accessible by any authenticated user (REVIEWER and TEAM_LEAD can see recommendations).
    
    Args:
        case_id: Case ID
        current_user: Authenticated user
        db: Database session
    
    Returns:
        List of recommendations with rule_id, name, recommendation, priority
    
    Raises:
        HTTPException 404 if case not found
    """
    case = db.query(Case).filter(Case.id == case_id).first()
    
    if not case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Case {case_id} not found",
        )
    
    recommendations = Recommender.get_recommendations(case, db)
    return recommendations
