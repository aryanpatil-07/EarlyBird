"""Authentication router for the documented demo login flow."""

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import get_current_user, make_access_token, user_display_name
from app.database import get_db
from app.models import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    """Login request body."""

    userId: str


class IdentityResponse(BaseModel):
    """Authenticated identity response."""

    accessToken: str
    role: str
    userId: str
    name: str
    tokenType: str = "bearer"


@router.post("/login", response_model=IdentityResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)) -> IdentityResponse:
    """Look up a seeded demo user and return a stable bearer token."""
    user = db.query(User).filter(User.user_id == request.userId).first()

    if not user:
        logger.warning("Login failed: user_id=%s not found", request.userId)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"User '{request.userId}' not found",
        )

    logger.info("Login successful: user_id=%s role=%s", user.user_id, user.role)
    return IdentityResponse(
        accessToken=make_access_token(user),
        role=user.role,
        userId=user.user_id,
        name=user_display_name(user),
    )


@router.get("/session", response_model=IdentityResponse)
def session(current_user: User = Depends(get_current_user)) -> IdentityResponse:
    """Return the identity represented by the current bearer token."""
    return IdentityResponse(
        accessToken=make_access_token(current_user),
        role=current_user.role,
        userId=current_user.user_id,
        name=user_display_name(current_user),
    )
