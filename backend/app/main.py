"""
EarlyBird Fraud Detection Platform — Main FastAPI Application

Phase 0: Scaffolding baseline with health check and CORS middleware.
Phase 1: Detection cycle with APScheduler.
Phase 2: Correlation cycle with APScheduler.
Phase 3: SLA auto-escalation cycle with APScheduler.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.database import init_db, get_db
from apscheduler.schedulers.background import BackgroundScheduler
from app.scheduler.detection_cycle import detection_cycle_callback
from app.scheduler.correlation_cycle import correlation_cycle_callback
from app.cases.sla import sla_escalation_callback
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
    
    # Startup: Initialize database and scheduler
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
        
        # Start SLA escalation cycle: every 1 minute
        scheduler.add_job(
            sla_escalation_callback,
            'interval',
            minutes=1,
            id='sla_escalation',
            name='SLA Escalation (Auto-escalate cases exceeding 2-hour window)'
        )
        logger.info("SLA escalation cycle scheduled (every 1 minute)")
        
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
    allow_origins=["http://localhost:3000", "http://localhost"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
from app.routers import cases_router
app.include_router(cases_router)


# Health check endpoint
@app.get("/health", tags=["health"])
async def health_check():
    """Simple health check endpoint."""
    return {"status": "ok", "service": "EarlyBird API"}


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
