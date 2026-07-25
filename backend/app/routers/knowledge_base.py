"""Knowledge base API endpoints (Phase 5 — M5).

Implements FR-040, FR-041:
- FR-040: Knowledge base auto-populated from resolved cases
- FR-041: Full-text search on KB entries

Endpoints:
- GET /knowledge-base/search?q=<query>&limit=20 — Search KB by keyword
- GET /knowledge-base/{kb_id} — Retrieve KB entry by ID
- GET /knowledge-base/case/{case_id} — Get KB entry for a case
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel

from app.database import get_db
from app.knowledge_base.search import search_knowledge_base, get_kb_entry_by_id, get_kb_entry_by_case_id

import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/knowledge-base", tags=["knowledge-base"])


# Pydantic models for API responses
class KBSearchResult(BaseModel):
    """Knowledge base search result."""
    id: int
    case_id: str
    title: str
    created_at: datetime
    relevance_score: float = 0.0


class KBEntryDetail(BaseModel):
    """Full knowledge base entry."""
    id: int
    case_id: str
    title: str
    content: str
    created_at: datetime


@router.get("/search", response_model=List[KBSearchResult])
def search_knowledge_base_endpoint(
    q: str = Query(..., min_length=1, max_length=500, description="Search query"),
    limit: int = Query(20, ge=1, le=100, description="Max results"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    db: Session = Depends(get_db),
):
    """
    Full-text search on knowledge base entries.
    
    Uses PostgreSQL tsvector + tsquery for efficient full-text search.
    Case-insensitive, handles multiple keywords.
    
    Args:
        q: Search query (keywords)
        limit: Max results (1-100, default 20)
        offset: Pagination offset (default 0)
    
    Returns:
        List of search results ranked by relevance
    
    FR-041: Full-text search
    """
    try:
        results = search_knowledge_base(
            query=q,
            limit=limit,
            offset=offset,
            db=db,
        )
        
        logger.info(f"KB search: query='{q}', results={len(results)}")
        
        return [
            KBSearchResult(
                id=r["id"],
                case_id=r["case_id"],
                title=r["title"],
                created_at=r["created_at"],
                relevance_score=r.get("relevance_score", 0.0),
            )
            for r in results
        ]
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error searching knowledge base: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/{kb_id}", response_model=KBEntryDetail)
def get_knowledge_base_entry(
    kb_id: int,
    db: Session = Depends(get_db),
):
    """
    Retrieve a specific knowledge base entry by ID.
    
    Args:
        kb_id: Knowledge base entry ID
    
    Returns:
        Full KB entry with content
    """
    try:
        entry = get_kb_entry_by_id(kb_id, db)
        
        return KBEntryDetail(
            id=entry["id"],
            case_id=entry["case_id"],
            title=entry["title"],
            content=entry["content"],
            created_at=entry["created_at"],
        )
    
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error retrieving KB entry {kb_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/case/{case_id}", response_model=Optional[KBEntryDetail])
def get_knowledge_base_entry_for_case(
    case_id: str,
    db: Session = Depends(get_db),
):
    """
    Retrieve knowledge base entry for a specific case.
    
    Returns None if case has not been resolved (no KB entry yet).
    
    Args:
        case_id: Case ID string
    
    Returns:
        KB entry if exists, or null
    """
    try:
        entry = get_kb_entry_by_case_id(case_id, db)
        
        if not entry:
            return None
        
        return KBEntryDetail(
            id=entry["id"],
            case_id=entry["case_id"],
            title=entry["title"],
            content=entry["content"],
            created_at=entry["created_at"],
        )
    
    except Exception as e:
        logger.error(f"Error retrieving KB entry for case {case_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
