"""Pytest configuration and fixtures."""

import pytest
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from app.models import Base

# Use test database URL (or same as dev)
DATABASE_URL_TEST = os.getenv(
    "DATABASE_URL",
    "postgresql://earlybird:earlybird_dev@localhost:5432/earlybird_db"
)

engine = create_engine(DATABASE_URL_TEST)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db() -> Session:
    """Provide a test database session."""
    # Create all tables
    Base.metadata.create_all(bind=engine)
    
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        # Clean up (drop all tables after each test)
        Base.metadata.drop_all(bind=engine)
