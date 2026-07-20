"""
EarlyBird Fraud Detection Platform — Main FastAPI Application

Phase 0: Scaffolding baseline with health check and CORS middleware.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.database import init_db, get_db
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    logger.info("Starting EarlyBird application...")
    # Startup: Initialize database connection pool
    yield
    logger.info("Shutting down EarlyBird application...")
    # Shutdown: Close connections


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


# Placeholder endpoints (will be populated in subsequent phases)
@app.get("/cases", tags=["cases"])
async def get_cases():
    """Placeholder: Get cases queue (implemented in M3)."""
    return {"message": "Cases endpoint — coming in Phase 3"}


@app.get("/anomalies", tags=["anomalies"])
async def get_anomalies():
    """Placeholder: Get anomalies (implemented in M1)."""
    return {"message": "Anomalies endpoint — coming in Phase 1"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
