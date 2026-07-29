"""
Knowledge base domain service — Markdown generation, full-text search, and retrieval.
"""

from typing import List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.models import KnowledgeBase, Case


def search_knowledge_base(
    db: Session,
    search_query: str = "",
    page: int = 1,
    page_size: int = 20
) -> Dict[str, Any]:
    """
    Search knowledge base entries by free text query with fallback to recent entries.
    """
    query = db.query(KnowledgeBase)

    if search_query.strip():
        term = f"%{search_query.strip()}%"
        query = query.filter(
            or_(
                KnowledgeBase.title.ilike(term),
                KnowledgeBase.content.ilike(term),
                KnowledgeBase.summary.ilike(term),
                KnowledgeBase.decision_summary.ilike(term)
            )
        )

    total = query.count()
    items = (
        query.order_by(KnowledgeBase.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return {
        "items": [
            {
                "id": item.id,
                "case_id": item.case_id,
                "title": item.title,
                "summary": item.summary or item.title,
                "root_cause_summary": item.root_cause_summary or "Root cause correlation completed",
                "decision_summary": item.decision_summary or "Case resolved",
                "content": item.content,
                "created_at": item.created_at.isoformat()
            }
            for item in items
        ],
        "total": total,
        "page": page,
        "page_size": page_size
    }
