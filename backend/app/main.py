"""
EarlyBird Fraud Detection Platform — Main FastAPI Application

Phase 0: Scaffolding baseline with health check and CORS middleware.
Phase 1: Detection cycle with APScheduler.
Phase 2: Correlation cycle with APScheduler.
"""

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.database import init_db, get_db
from apscheduler.schedulers.background import BackgroundScheduler
from app.scheduler.detection_cycle import detection_cycle_callback
from app.scheduler.correlation_cycle import correlation_cycle_callback
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global scheduler instance
scheduler = BackgroundScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    logger.info("Starting EarlyBird application...")
    
    # Startup: Initialize database, default users, and scheduler
    try:
        init_db()
        from app.models import User
        from app.database import SessionLocal
        with SessionLocal() as db_session:
            demo_users = [
                ("1", "Reviewer Alex", "REVIEWER"),
                ("2", "Team Lead Sarah", "TEAM_LEAD"),
                ("12345", "Reviewer 12345", "REVIEWER"),
                ("67890", "Team Lead 67890", "TEAM_LEAD"),
                ("system", "System User", "TEAM_LEAD"),
            ]
            for uid, name, role in demo_users:
                existing = db_session.query(User).filter(User.user_id == uid).first()
                if not existing:
                    db_session.add(User(user_id=uid, name=name, role=role, is_active=True))
            db_session.commit()
            logger.info("Demo users verified/seeded successfully.")
    except Exception as e:
        logger.warning(f"Database/demo user initialization: {e}")

    try:
        # Start detection cycle: every 5 minutes
        scheduler.add_job(
            detection_cycle_callback,
            'interval',
            minutes=5,
            id='detection_cycle',
            name='Detection Cycle (Score Unscored Transactions)'
        )
        logger.info("Detection cycle scheduled (every 5 minutes)")
        
        # Start correlation cycle: every 10 minutes (after detection)
        scheduler.add_job(
            correlation_cycle_callback,
            'interval',
            minutes=10,
            id='correlation_cycle',
            name='Correlation Cycle (Find Related Anomalies)'
        )
        logger.info("Correlation cycle scheduled (every 10 minutes)")
        
        # Start scheduler
        scheduler.start()
        logger.info("Background scheduler started")
    except Exception as e:
        logger.error(f"Failed to start scheduler: {e}")
    
    yield
    
    logger.info("Shutting down EarlyBird application...")
    # Shutdown: Stop scheduler
    if scheduler.running:
        scheduler.shutdown()
        logger.info("Background scheduler stopped")


# Create FastAPI app
app = FastAPI(
    title="EarlyBird Fraud Detection API",
    description="Transaction fraud anomaly detection platform",
    version="0.1.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost",
        "http://127.0.0.1:3000",
        "http://127.0.0.1",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:[0-9]+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
from app.routers import cases_router, knowledge_base_router
from app.routers import playbooks, dashboard, auth

from app.cases.concurrency import StaleEntityException
from app.cases.state_machine import InvalidStateTransitionException

API_V1_PREFIX = "/api/v1"


@app.exception_handler(HTTPException)
async def http_exception_handler(_request: Request, exc: HTTPException):
    """Return the documented API error envelope."""
    code_by_status = {
        400: "INVALID_REQUEST",
        401: "UNAUTHORIZED",
        403: "FORBIDDEN",
        404: "NOT_FOUND",
        409: "STALE_CASE_STATE",
        422: "VALIDATION_ERROR",
    }
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": code_by_status.get(exc.status_code, "SERVER_ERROR"),
                "message": str(exc.detail),
            }
        },
        headers=getattr(exc, "headers", None),
    )


@app.exception_handler(StaleEntityException)
async def stale_entity_exception_handler(_request: Request, exc: StaleEntityException):
    return JSONResponse(
        status_code=409,
        content={
            "error": {
                "code": "STALE_CASE_STATE",
                "message": str(exc),
                "field": "version"
            }
        }
    )


@app.exception_handler(InvalidStateTransitionException)
async def invalid_transition_exception_handler(_request: Request, exc: InvalidStateTransitionException):
    return JSONResponse(
        status_code=400,
        content={
            "error": {
                "code": "INVALID_STATE_TRANSITION",
                "message": str(exc),
                "field": "state"
            }
        }
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Request validation failed",
                "field": exc.errors()[0].get("loc", [None])[-1] if exc.errors() else None,
            }
        },
    )


for router in (auth.router, cases_router, knowledge_base_router, playbooks.router, dashboard.router):
    app.include_router(router, prefix=API_V1_PREFIX)
    app.include_router(router)


# Health check endpoint
@app.get("/health", tags=["health"])
async def health_check():
    """Simple health check endpoint."""
    return {"status": "ok", "service": "EarlyBird API"}


@app.get(f"{API_V1_PREFIX}/health", tags=["health"])
async def api_v1_health_check():
    """Canonical API health check endpoint."""
    return {"status": "ok", "service": "EarlyBird API", "apiVersion": "v1"}


# Root endpoint
@app.get("/", tags=["root"])
async def root():
    """Root endpoint."""
    return {
        "message": "Welcome to EarlyBird Fraud Detection Platform",
        "docs": "/docs",
        "version": "0.1.0"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
