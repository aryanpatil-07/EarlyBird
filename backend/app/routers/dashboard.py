"""
Dashboard router — M6

Endpoints:
- GET /dashboard/metrics — all six metrics
- GET /audit-log — filtered audit log
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db
from app.models import AuditLog
from app.dashboard.metrics import get_all_metrics
from app.auth import get_current_user

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/metrics")
def get_metrics(session: Session = Depends(get_db), _current_user = Depends(get_current_user)):
    """
    GET /dashboard/metrics
    
    Returns all six key metrics:
    - precision: TP / (TP + FP) from anomaly detection
    - recall: TP / (TP + FN)
    - rca_accuracy: placeholder (manual validation in M8)
    - kb_coverage: KB entries / resolved cases
    - sla_compliance: resolved within 2h / total
    - dedup_rate: (anomalies - cases) / anomalies
    
    Accessible to: REVIEWER, TEAM_LEAD
    """
    try:
        metrics = get_all_metrics(session)
        return metrics
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/audit-log")
def get_audit_log(
    entity_type: Optional[str] = Query(None, description="Filter by entity type (e.g., 'case')"),
    entity_id: Optional[str] = Query(None, description="Filter by entity ID"),
    limit: int = Query(100, description="Max results"),
    offset: int = Query(0, description="Pagination offset"),
    session: Session = Depends(get_db),
    _current_user = Depends(get_current_user)
):
    """
    GET /audit-log
    
    Query parameters:
    - entity_type (optional): 'case', 'playbook_rule', etc.
    - entity_id (optional): specific entity ID
    - limit: max results (default 100)
    - offset: pagination offset (default 0)
    
    Returns list of audit log entries with most recent first.
    
    Example:
    - GET /audit-log?entity_type=case&entity_id=CASE-001
      → all actions on case CASE-001
    
    - GET /audit-log?entity_type=case&limit=20
      → 20 most recent case actions
    
    Accessible to: REVIEWER, TEAM_LEAD
    """
    try:
        query = session.query(AuditLog)
        
        if entity_type:
            query = query.filter(AuditLog.entity_type == entity_type)
        
        if entity_id:
            query = query.filter(AuditLog.entity_id == entity_id)
        
        # Order by created_at descending (most recent first)
        total_count = query.count()
        
        logs = query.order_by(AuditLog.created_at.desc()).offset(offset).limit(limit).all()
        
        return {
            "total": total_count,
            "offset": offset,
            "limit": limit,
            "logs": [
                {
                    "id": log.id,
                    "entity_type": log.entity_type,
                    "entity_id": log.entity_id,
                    "action": log.action,
                    "actor_id": log.actor_id,
                    "changes": log.changes,
                    "created_at": log.created_at.isoformat() + "Z" if log.created_at else None
                }
                for log in logs
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
