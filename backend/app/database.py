"""
SQLAlchemy database initialization and connection pooling.

Phase 0: Base configuration for PostgreSQL connection.
"""

import os
from sqlalchemy import create_engine, Engine, text
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import QueuePool
import logging

logger = logging.getLogger(__name__)

# Database connection string from environment or default
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://earlybird:earlybird_dev@localhost:5432/earlybird_db"
)
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

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


def reconcile_schema():
    """Ensure all columns defined in SQLAlchemy models exist in the target database."""
    from app.models import Base
    import sqlalchemy as sa
    
    try:
        inspector = sa.inspect(engine)
        with engine.begin() as conn:
            for table_name, table in Base.metadata.tables.items():
                if inspector.has_table(table_name):
                    existing_cols = {col["name"] for col in inspector.get_columns(table_name)}
                    for col in table.columns:
                        if col.name not in existing_cols:
                            col_type = col.type.compile(engine.dialect)
                            conn.execute(sa.text(f'ALTER TABLE "{table_name}" ADD COLUMN IF NOT EXISTS "{col.name}" {col_type} NULL'))
                            logger.info(f"Reconciled schema: added missing column '{col.name}' to table '{table_name}'")
    except Exception as e:
        logger.warning(f"Schema reconciliation notice: {e}")


def init_db():
    """Initialize database (create tables from Base metadata and reconcile columns)."""
    from app.models import Base
    logger.info("Initializing database...")
    Base.metadata.create_all(bind=engine)
    reconcile_schema()
    logger.info("Database initialized successfully.")


def test_connection():
    """Test database connection."""
    try:
        with engine.connect() as connection:
            result = connection.execute(text("SELECT 1"))
            logger.info("Database connection successful.")
            return True
    except Exception as e:
        logger.error(f"Database connection failed: {e}")
        return False
