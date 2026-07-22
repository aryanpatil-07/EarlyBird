"""Authentication utilities for EarlyBird."""

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User


def get_current_user(
    authorization: str = None,
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
    
    # token is the user_id
    user_id = token
    user = db.query(User).filter(User.user_id == user_id).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    
    return user
