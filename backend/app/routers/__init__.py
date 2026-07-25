"""API routers for EarlyBird — organized by domain."""

from app.routers.cases import router as cases_router
from app.routers.knowledge_base import router as knowledge_base_router

__all__ = ["cases_router", "knowledge_base_router"]
