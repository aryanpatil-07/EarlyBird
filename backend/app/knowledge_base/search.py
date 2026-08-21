"""Knowledge base search — full-text search using PostgreSQL tsvector and tsquery.

Phase 5 (M5): Implements keyword-based search on KB content using PostgreSQL's native full-text search.

Key function:
- search_knowledge_base(): Performs full-text search query returning KB entries matching query
"""

from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Dict, Any
import logging

logger = logging.getLogger(__name__)


def search_knowledge_base(
    query: str,
    limit: int = 20,
    offset: int = 0,
    db: Session = None,
) -> List[Dict[str, Any]]:
    """
    Search knowledge base using PostgreSQL full-text search (tsvector + tsquery).
    
    Uses plainto_tsquery to avoid SQL injection and handle multiple keywords safely.
    
    Args:
        query: Search query string (keywords, case-insensitive)
        limit: Max results to return (default 20)
        offset: Pagination offset (default 0)
        db: Database session
    
    Returns:
        List of dicts: [{"id", "case_id", "title", "created_at", "relevance_score"}, ...]
    
    Raises:
        ValueError if query is empty or db session is None
    """
    
    if not query or not query.strip():
        raise ValueError("Search query cannot be empty")
    
    if db is None:
        raise ValueError("Database session required")
    
    # Clean query
    query_clean = query.strip().lower()
    
    # SQLite fallback for unit tests / non-PostgreSQL environments
    if db.bind and db.bind.dialect.name != "postgresql":
        from app.models import KnowledgeBase
        records = (
            db.query(KnowledgeBase)
            .filter(
                (KnowledgeBase.title.ilike(f"%{query_clean}%"))
                | (KnowledgeBase.content.ilike(f"%{query_clean}%"))
            )
            .order_by(KnowledgeBase.created_at.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )
        return [
            {
                "id": r.id,
                "case_id": r.case_id,
                "title": r.title,
                "created_at": r.created_at,
                "relevance_score": 1.0,
            }
            for r in records
        ]

    # Use ILIKE + plainto_tsquery for fast instant substring & keyword matching on PostgreSQL
    like_pattern = f"%{query_clean}%"
    search_sql = text("""
        SELECT 
            id,
            case_id,
            title,
            created_at,
            CASE 
                WHEN title ILIKE :like_pattern THEN 3.0
                WHEN case_id ILIKE :like_pattern THEN 2.5
                WHEN content ILIKE :like_pattern THEN 1.5
                ELSE ts_rank(to_tsvector('english', content), plainto_tsquery('english', :query))
            END as relevance_score
        FROM knowledge_base
        WHERE title ILIKE :like_pattern
           OR case_id ILIKE :like_pattern
           OR content ILIKE :like_pattern
           OR (to_tsvector('english', content) @@ plainto_tsquery('english', :query))
        ORDER BY relevance_score DESC, created_at DESC
        LIMIT :limit
        OFFSET :offset
    """)
    
    try:
        results = db.execute(
            search_sql,
            {
                "query": query_clean,
                "like_pattern": like_pattern,
                "limit": limit,
                "offset": offset,
            }
        ).fetchall()
        
        # Convert Row objects to dicts
        return [
            {
                "id": row[0],
                "case_id": row[1],
                "title": row[2],
                "created_at": row[3],
                "relevance_score": float(row[4]) if row[4] else 0.0,
            }
            for row in results
        ]
    
    except Exception as e:
        logger.error(f"Error searching knowledge base for query '{query}': {e}")
        raise


def get_total_kb_entries(db: Session) -> int:
    """
    Get total count of KB entries.
    
    Args:
        db: Database session
    
    Returns:
        Count of KB entries
    """
    if db is None:
        raise ValueError("Database session required")
    
    try:
        count_sql = text("SELECT COUNT(*) FROM knowledge_base")
        result = db.execute(count_sql).scalar()
        return result or 0
    except Exception as e:
        logger.error(f"Error getting KB entry count: {e}")
        raise


def get_kb_entry_by_id(kb_id: int, db: Session) -> Dict[str, Any]:
    """
    Retrieve a single KB entry by ID.
    
    Args:
        kb_id: KB entry ID
        db: Database session
    
    Returns:
        Dict with KB entry details: {"id", "case_id", "title", "content", "created_at"}
    
    Raises:
        ValueError if KB entry not found
    """
    if db is None:
        raise ValueError("Database session required")
    
    try:
        get_sql = text("""
            SELECT id, case_id, title, content, created_at
            FROM knowledge_base
            WHERE id = :kb_id
        """)
        
        result = db.execute(get_sql, {"kb_id": kb_id}).fetchone()
        
        if not result:
            raise ValueError(f"KB entry {kb_id} not found")
        
        return {
            "id": result[0],
            "case_id": result[1],
            "title": result[2],
            "content": result[3],
            "created_at": result[4],
        }
    except Exception as e:
        logger.error(f"Error retrieving KB entry {kb_id}: {e}")
        raise


def get_kb_entry_by_case_id(case_id: str, db: Session) -> Dict[str, Any]:
    """
    Retrieve KB entry for a specific case ID.
    
    Args:
        case_id: Case ID string
        db: Database session
    
    Returns:
        Dict with KB entry details or None if not found
    """
    if db is None:
        raise ValueError("Database session required")
    
    try:
        get_sql = text("""
            SELECT id, case_id, title, content, created_at
            FROM knowledge_base
            WHERE case_id = :case_id
            LIMIT 1
        """)
        
        result = db.execute(get_sql, {"case_id": case_id}).fetchone()
        
        if not result:
            return None
        
        return {
            "id": result[0],
            "case_id": result[1],
            "title": result[2],
            "content": result[3],
            "created_at": result[4],
        }
    except Exception as e:
        logger.error(f"Error retrieving KB entry for case {case_id}: {e}")
        raise
