"""
Dashboard router — M6

Endpoints:
- GET /dashboard/metrics — all six metrics
- GET /audit-log — filtered audit log
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional

from app.database import get_db
from app.models import Anomaly, AuditLog, Case, KnowledgeBase, Transaction
from app.dashboard.metrics import get_all_metrics
from app.auth import get_current_user

router = APIRouter(tags=["dashboard"])


def metric_value(value: float, denominator: int = 0) -> dict:
    return {"value": value, "denominator": denominator}


@router.get("/dashboard/metrics")
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
        total_cases = session.query(Case).count()
        total_anomalies = session.query(Anomaly).count()
        total_transactions = session.query(Transaction).count()
        resolved_cases = session.query(Case).filter(Case.state == "RESOLVED").count()
        kb_entries = session.query(KnowledgeBase).count()
        open_cases = session.query(Case).filter(Case.state.in_(["NEW", "ACCEPTED", "ESCALATED"])).count()
        resolved = session.query(Case).filter(Case.resolved_at.isnot(None)).all()

        if resolved:
            mttr = sum((case.resolved_at - case.created_at).total_seconds() / 60 for case in resolved if case.created_at) / len(resolved)
        else:
            mttr = 0.0

        acknowledged_logs = session.query(AuditLog).filter(AuditLog.action.in_(["accept", "CASE_ACKNOWLEDGED"])).all()
        if acknowledged_logs:
            mttd = sum((log.created_at - session.query(Case).filter(Case.id == int(log.entity_id)).first().created_at).total_seconds() / 60 for log in acknowledged_logs if log.entity_id.isdigit() and session.query(Case).filter(Case.id == int(log.entity_id)).first()) / len(acknowledged_logs)
        else:
            mttd = 0.0

        dedup_rate = metrics.get("dedup_rate", 0.0) * 100
        sla_ack = metrics.get("sla_compliance", 0.0) * 100
        docs_coverage = (kb_entries / resolved_cases * 100) if resolved_cases else 0.0
        detection_rate = (total_anomalies / total_transactions * 100) if total_transactions else 0.0

        return {
            **metrics,
            "mttdMinutes": round(mttd, 2),
            "mttrMinutes": round(mttr, 2),
            "alertsBeforeDedup": total_anomalies,
            "alertsAfterDedup": total_cases,
            "pctAlertsAckWithinSla": round(sla_ack, 2),
            "pctCasesWithDocumentedRootCause": round(docs_coverage, 2),
            "computedAt": datetime.utcnow().isoformat() + "Z",
            "counts": {
                "transactions": total_transactions,
                "openCases": open_cases,
                "resolvedCases": resolved_cases,
                "knowledgeBaseEntries": kb_entries,
            },
            # Transitional aliases used by the current dashboard screen.
            "cases_processed_24h": resolved_cases,
            "detection_rate": round(detection_rate, 2),
            "sla_compliance": round(sla_ack, 2),
            "false_positive_rate": round((1 - metrics.get("precision", 0.0)) * 100, 2),
            "current_workload": open_cases,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def build_audit_response(query, page: int, page_size: int):
    total_count = query.count()
    logs = query.order_by(AuditLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    entries = [
        {
            "id": str(log.id),
            "entityType": log.entity_type,
            "entityId": log.entity_id,
            "entity_type": log.entity_type,
            "entity_id": log.entity_id,
            "action": log.action,
            "actor": log.actor_id,
            "actorId": log.actor_id,
            "changes": log.changes,
            "createdAt": log.created_at.isoformat() + "Z" if log.created_at else None,
            "created_at": log.created_at.isoformat() + "Z" if log.created_at else None,
        }
        for log in logs
    ]
    return {
        "items": entries,
        "entries": entries,
        "logs": entries,
        "total": total_count,
        "page": page,
        "pageSize": page_size,
        "limit": page_size,
        "offset": (page - 1) * page_size,
    }


@router.get("/audit-log")
def get_audit_log(
    entity_type: Optional[str] = Query(None, description="Filter by entity type (e.g., 'case')"),
    entity_id: Optional[str] = Query(None, description="Filter by entity ID"),
    page: int = Query(1, ge=1),
    pageSize: int = Query(100, ge=1, le=500),
    limit: Optional[int] = Query(None, description="Max results"),
    offset: Optional[int] = Query(None, description="Pagination offset"),
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
        
        page_size = limit or pageSize
        if offset is not None:
            page = (offset // page_size) + 1
        return build_audit_response(query, page, page_size)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/dashboard/audit-log")
def get_dashboard_audit_log(
    entity_type: Optional[str] = Query(None),
    entity_id: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    session: Session = Depends(get_db),
    _current_user = Depends(get_current_user),
):
    query = session.query(AuditLog)
    if entity_type:
        query = query.filter(AuditLog.entity_type == entity_type)
    if entity_id:
        query = query.filter(AuditLog.entity_id == entity_id)
    return build_audit_response(query, (offset // limit) + 1, limit)
