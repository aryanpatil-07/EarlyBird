"""Knowledge base module — auto-generated KB entries from resolved cases with full-text search.

Phase 5 (M5): Auto-generation on case resolution and full-text search using PostgreSQL tsvector.

Key components:
- generator.py: Generates KB entries (auto-title, structured markdown content)
- search.py: Full-text search using tsvector and tsquery
"""

from .generator import generate_kb_entry_from_case
from .search import search_knowledge_base

__all__ = [
    "generate_kb_entry_from_case",
    "search_knowledge_base",
]
