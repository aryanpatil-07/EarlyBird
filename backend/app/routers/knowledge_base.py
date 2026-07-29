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
from app.models import KnowledgeBase
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


def kb_summary(entry: KnowledgeBase, relevance_score: float = 0.0) -> dict:
    return {
        "id": entry.id,
        "case_id": entry.case_id,
        "resolved_case_id": entry.case_id,
        "title": entry.title,
        "summary": entry.content[:240],
        "created_at": entry.created_at,
        "createdAt": entry.created_at.isoformat() + "Z" if entry.created_at else None,
        "relevance_score": relevance_score,
    }


@router.get("")
def list_knowledge_base_endpoint(
    search: str = Query("", max_length=500, description="Search query"),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Return recent KB entries or full-text search results in a collection envelope."""
    offset = (page - 1) * pageSize
    try:
        if search.strip():
            results = search_knowledge_base(query=search, limit=pageSize, offset=offset, db=db)
            items = [
                {
                    "id": r["id"],
                    "case_id": r["case_id"],
                    "resolved_case_id": r["case_id"],
                    "title": r["title"],
                    "summary": "",
                    "created_at": r["created_at"],
                    "createdAt": r["created_at"].isoformat() + "Z" if r.get("created_at") else None,
                    "relevance_score": r.get("relevance_score", 0.0),
                }
                for r in results
            ]
            total = len(items) if len(items) < pageSize else db.query(KnowledgeBase).count()
        else:
            query = db.query(KnowledgeBase).order_by(KnowledgeBase.created_at.desc())
            total = query.count()
            items = [kb_summary(entry) for entry in query.offset(offset).limit(pageSize).all()]

        return {
            "items": items,
            "entries": items,
            "page": page,
            "pageSize": pageSize,
            "total": total,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error searching knowledge base: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/search", response_model=List[KBSearchResult])
def search_knowledge_base_endpoint(
    q: str = Query(..., min_length=1, max_length=500, description="Search query"),
    limit: int = Query(20, ge=1, le=100, description="Max results"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    db: Session = Depends(get_db),
):
    """Legacy search endpoint retained during the /api/v1 migration."""
    results = search_knowledge_base(query=q, limit=limit, offset=offset, db=db)
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


@router.get("/case/{case_id}", response_model=Optional[KBEntryDetail])
def get_knowledge_base_entry_for_case(
    case_id: str,
    db: Session = Depends(get_db),
):
    """
    Retrieve knowledge base entry for a specific case.
    
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
