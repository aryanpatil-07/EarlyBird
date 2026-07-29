"""Authentication utilities for EarlyBird.

The MVP deliberately uses a simple bearer token, but the token now comes from
the login endpoint and resolves to a seeded user on every authenticated route.
"""

from fastapi import Depends, HTTPException, status, Header
from sqlalchemy.orm import Session
from typing import Optional
from app.database import get_db
from app.models import User


def user_display_name(user: User) -> str:
    """Return a stable display name without requiring a schema migration."""
    if user.user_id in {"1", "reviewer_1", "test_reviewer"}:
        return "Reviewer"
    if user.user_id in {"2", "team_lead_1", "team_lead"}:
        return "Team Lead"
    return user.user_id.replace("_", " ").title()


def make_access_token(user: User) -> str:
    """Return the bearer token used by the demo auth flow."""
    return user.user_id


def get_current_user(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> User:
    """
    Get current user from Authorization header.
    
    Simple auth: Bearer {user_id}
    
    Args:
        authorization: Authorization header value
        db: Database session
    
    Returns:
        User instance
    
    Raises:
        HTTPException 401 if not authenticated or user not found
        HTTPException 403 if unauthorized
    """
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
            detail="Invalid Authorization header format (expected: Bearer {user_id})",
        )
    
    user = db.query(User).filter(User.user_id == token).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    
    return user


def require_team_lead(current_user: User = Depends(get_current_user)) -> User:
    """Restrict a route to Team Lead users."""
    if current_user.role != "TEAM_LEAD":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Team Lead can perform this action",
        )
    return current_user
