"""Pytest configuration and fixtures."""

import pytest
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from app.models import Base

# Use test database URL (defaults to in-memory SQLite to avoid wiping dev database)
DATABASE_URL_TEST = os.getenv(
    "TEST_DATABASE_URL",
    "sqlite:///:memory:"
)

engine = create_engine(
    DATABASE_URL_TEST,
    connect_args={"check_same_thread": False} if DATABASE_URL_TEST.startswith("sqlite") else {}
)
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
