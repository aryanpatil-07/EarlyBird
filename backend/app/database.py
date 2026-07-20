"""
SQLAlchemy database initialization and connection pooling.

Phase 0: Base configuration for PostgreSQL connection.
"""

import os
from sqlalchemy import create_engine, Engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import QueuePool
import logging

logger = logging.getLogger(__name__)

# Database connection string from environment or default
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://earlybird:earlybird_dev@localhost:5432/earlybird_db"
)

# Create engine with connection pooling
engine: Engine = create_engine(
    DATABASE_URL,
    poolclass=QueuePool,
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,  # Test connections before using
    echo=False,  # Set to True for SQL logging
)

# Session factory
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)


def get_db() -> Session:
    """Dependency injection for database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Initialize database (create tables from Base metadata)."""
    from app.models import Base
    logger.info("Initializing database...")
    Base.metadata.create_all(bind=engine)
    logger.info("Database initialized successfully.")


def test_connection():
    """Test database connection."""
    try:
        with engine.connect() as connection:
            result = connection.execute("SELECT 1")
            logger.info("Database connection successful.")
            return True
    except Exception as e:
        logger.error(f"Database connection failed: {e}")
        return False
