"""
Authentication router — Simple bearer token auth.

Phase 0: Basic auth with user_id in Authorization header.
No passwords, no SSO, no JWT complexity.

Endpoints:
- POST /auth/login { userId: "1" } -> { access_token, token_type }
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    """Login request body."""
    userId: str  # User ID (matches User.user_id in database)


class LoginResponse(BaseModel):
    """Login response body."""
    access_token: str  # Bearer token (just the user_id for simplicity)
    token_type: str = "bearer"


@router.post("/login", response_model=LoginResponse)
def login(
    request: LoginRequest,
    db: Session = Depends(get_db),
):
    """
    Simple bearer token login.
    
    No password required. Just provide userId from seeded users:
    - userId: "1" → REVIEWER role
    - userId: "2" → TEAM_LEAD role
    
    Returns access_token to use in Authorization header: Bearer {token}
    
    Per 07-API-Specification.md §4: Auth Endpoints
    """
    logger.info(f"Login attempt: user_id={request.userId}")
    
    # Check if user exists
    user = db.query(User).filter(User.user_id == request.userId).first()
    
    if not user:
        logger.warning(f"Login failed: user_id={request.userId} not found")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"User '{request.userId}' not found. Available users: '1' (REVIEWER), '2' (TEAM_LEAD)",
        )
    
    logger.info(f"Login successful: user_id={request.userId}, role={user.role}")
    
    # Return access token (simplified: just the user_id)
    # In production, this would be a JWT or session token
    return LoginResponse(
        access_token=request.userId,
        token_type="bearer",
    )
