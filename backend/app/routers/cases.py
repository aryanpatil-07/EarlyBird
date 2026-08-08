"""Case workflow API endpoints."""

import logging
from datetime import datetime, timedelta
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.cases.concurrency import StaleEntityException, check_version, increment_version
from app.cases.dedup import calculate_dedup_stats
from app.cases.state_machine import CaseState, CaseStateMachine, InvalidStateTransitionException
from app.database import get_db
from app.knowledge_base import generate_kb_entry_from_case
from app.models import Anomaly, AuditLog, Case, KnowledgeBase, RootCauseLink, Transaction, User
from app.playbooks.recommender import Recommender

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/cases", tags=["cases"])

SLA_HOURS = 2


class CaseActionRequest(BaseModel):
    version: int
    decision: Optional[str] = None
    rationale: Optional[str] = None
    note: Optional[str] = None
    category: Optional[str] = None
    verification_methods: Optional[list[str]] = None
    follow_up_action: Optional[str] = None


class CaseEscalateRequest(BaseModel):
    version: int
    reason: Optional[str] = None
    note: Optional[str] = None
    category: Optional[str] = None
    verification_methods: Optional[list[str]] = None
    priority_level: Optional[str] = None


def iso(value: Optional[datetime]) -> Optional[str]:
    return value.isoformat() + "Z" if value else None


def canonical_state(state: str) -> str:
    return "ACKNOWLEDGED" if state == CaseState.ACCEPTED.value else state


def legacy_state(state: str) -> str:
    return CaseState.ACCEPTED.value if state == "ACKNOWLEDGED" else state


def case_sort_state_values(state: Optional[str]) -> Optional[list[str]]:
    if not state:
        return None
    if state.strip().upper() == "ALL":
        return [s.value for s in CaseState]
    values = []
    for raw in state.split(","):
        value = legacy_state(raw.strip().upper())
        if value:
            values.append(value)
    valid = {s.value for s in CaseState}
    invalid = [value for value in values if value not in valid]
    if invalid:
        raise HTTPException(status_code=400, detail=f"Invalid state: {', '.join(invalid)}")
    return values


def get_case_or_404(db: Session, case_ref: str) -> Case:
    query = db.query(Case)
    case = None
    if str(case_ref).isdigit():
        case = query.filter(Case.id == int(case_ref)).first()
    if not case:
        case = query.filter(Case.case_id == case_ref).first()
    if not case:
        raise HTTPException(status_code=404, detail=f"Case {case_ref} not found")
    return case


def first_case_anomaly(db: Session, case: Case) -> Optional[Anomaly]:
    if case.recommendations and isinstance(case.recommendations, dict):
        anomaly_ids = case.recommendations.get("anomaly_ids") or []
        if anomaly_ids:
            return db.query(Anomaly).filter(Anomaly.id == anomaly_ids[0]).first()
    return db.query(Anomaly).order_by(Anomaly.created_at.desc()).first()


def anomaly_transaction(db: Session, anomaly: Optional[Anomaly]) -> Optional[Transaction]:
    if not anomaly:
        return None
    return db.query(Transaction).filter(Transaction.id == anomaly.transaction_id).first()


def build_queue_item(db: Session, case: Case) -> dict[str, Any]:
    anomaly = first_case_anomaly(db, case)
    tx = anomaly_transaction(db, anomaly)
    entity_ref = tx.card_id if tx else f"CASE-{case.id}"
    score = anomaly.score if anomaly else float(case.priority or 0)
    deadline = case.created_at + timedelta(hours=SLA_HOURS) if case.created_at else None
    duplicate_count = 1
    if case.recommendations and isinstance(case.recommendations, dict):
        duplicate_count = int(case.recommendations.get("duplicate_count", 1) or 1)

    return {
        "id": str(case.id),
        "caseId": case.case_id,
        "status": canonical_state(case.state),
        "state": case.state,
        "severity": case.severity,
        "priority": case.priority,
        "version": case.version,
        "entityRef": entity_ref,
        "entity_id": entity_ref,
        "anomalyScore": score,
        "anomaly_score": score,
        "duplicateCount": duplicate_count,
        "slaDeadline": iso(deadline),
        "createdAt": iso(case.created_at),
        "created_at": iso(case.created_at),
        "updatedAt": iso(case.updated_at),
    }


def build_case_detail(db: Session, case: Case) -> dict[str, Any]:
    anomaly = first_case_anomaly(db, case)
    tx = anomaly_transaction(db, anomaly)
    queue_item = build_queue_item(db, case)
    links = []
    related_ids = []
    if anomaly:
        for link in db.query(RootCauseLink).filter(RootCauseLink.anomaly_id == anomaly.id).all():
            related_ids.append(str(link.related_anomaly_id))
            related = db.query(Anomaly).filter(Anomaly.id == link.related_anomaly_id).first()
            related_tx = anomaly_transaction(db, related)
            links.append(
                {
                    "transaction_id": str(related_tx.id if related_tx else link.related_anomaly_id),
                    "link_type": link.link_type,
                    "explanation": (link.evidence or {}).get("explanation", link.link_type),
                    "transaction": {
                        "id": str(related_tx.id if related_tx else link.related_anomaly_id),
                        "entity_id": related_tx.card_id if related_tx else queue_item["entityRef"],
                        "merchant_id": related_tx.merchant_id if related_tx else "",
                        "amount": related_tx.amount if related_tx else 0,
                        "timestamp": iso(related_tx.timestamp) if related_tx else queue_item["createdAt"],
                        "mcc": "",
                    },
                }
            )

    recommendations = []
    try:
        recommendations = [
            {
                "rule_id": str(item.get("rule_id")),
                "ruleId": item.get("rule_id"),
                "ruleName": item.get("name"),
                "recommendation_text": item.get("recommendation"),
                "action": item.get("recommendation"),
                "priority": item.get("priority"),
                "condition": {},
            }
            for item in Recommender.get_recommendations(case, db)
        ]
    except Exception as exc:
        logger.info("Recommendation matching skipped for case %s: %s", case.id, exc)

    kb = db.query(KnowledgeBase).filter(KnowledgeBase.case_id == case.case_id).first()
    audit = db.query(AuditLog).filter(
        AuditLog.entity_type == "case",
        AuditLog.entity_id.in_([str(case.id), case.case_id]),
    ).order_by(AuditLog.created_at.asc()).all()

    baseline_mean = anomaly.baseline if anomaly else 0
    score = anomaly.score if anomaly else 0
    deviation = anomaly.deviation if anomaly else 0
    baseline_stddev = abs(deviation / score) if score else 1

    latest_decision_log = None
    for log in reversed(audit):
        if log.changes and (log.changes.get("note") or log.changes.get("category") or log.changes.get("verification_methods") or log.action in ["CASE_ACCEPTED", "CASE_REJECTED", "CASE_MODIFIED", "CASE_ESCALATED", "CASE_RESOLVED"]):
            latest_decision_log = log
            break

    decision_summary = None
    if latest_decision_log and latest_decision_log.changes:
        changes = latest_decision_log.changes
        decision_summary = {
            "action": latest_decision_log.action,
            "actor": latest_decision_log.actor_id,
            "actor_name": "Team Lead Sarah" if latest_decision_log.actor_id == "2" else ("Reviewer Alex" if latest_decision_log.actor_id == "1" else latest_decision_log.actor_id),
            "created_at": iso(latest_decision_log.created_at),
            "category": changes.get("category"),
            "verification_methods": changes.get("verification_methods") or [],
            "follow_up_action": changes.get("follow_up_action"),
            "rationale": changes.get("note") or latest_decision_log.reason,
        }

    return {
        **queue_item,
        "baseline_mean": baseline_mean,
        "baseline_stddev": baseline_stddev,
        "observedValue": tx.amount if tx else baseline_mean + deviation,
        "metric": "transaction_amount",
        "detectedAt": iso(anomaly.created_at) if anomaly else queue_item["createdAt"],
        "evidence": {
            "anomaly_ids": [str(anomaly.id)] if anomaly else [],
            "root_causes": links,
            "reason": (anomaly.evidence or {}).get("reason") if anomaly else None,
        },
        "rootCause": links,
        "related_anomalies": related_ids,
        "recommendations": recommendations,
        "decision_summary": decision_summary,
        "auditHistory": [
            {
                "id": str(log.id),
                "action": log.action,
                "actor": log.actor_id,
                "actorId": log.actor_id,
                "changes": log.changes,
                "reason": log.reason,
                "created_at": iso(log.created_at),
                "createdAt": iso(log.created_at),
            }
            for log in audit
        ],
        "knowledge_base_entry": {"id": str(kb.id), "title": kb.title} if kb else None,
    }


def audit_case(db: Session, case: Case, action: str, user: User, changes: dict[str, Any]) -> None:
    db.add(
        AuditLog(
            entity_type="case",
            entity_id=str(case.id),
            action=action,
            actor_id=user.user_id,
            changes=changes,
        )
    )


def transition_case(
    db: Session,
    case: Case,
    user: User,
    target_state: str,
    action: str,
    version: int,
    note: str = "",
    category: Optional[str] = None,
    verification_methods: Optional[list[str]] = None,
    follow_up_action: Optional[str] = None,
) -> Case:
    try:
        check_version(db, case.id, version)
        CaseStateMachine.validate_transition(case.state, target_state)
    except StaleEntityException as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except InvalidStateTransitionException as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    old_state = case.state
    case.state = target_state
    case.updated_at = datetime.utcnow()
    if target_state == CaseState.RESOLVED.value:
        case.resolved_at = datetime.utcnow()
    increment_version(db, case.id)
    
    changes = {
        "old_state": old_state,
        "new_state": target_state,
        "note": note,
        "category": category,
        "verification_methods": verification_methods or [],
        "follow_up_action": follow_up_action,
    }
    audit_case(db, case, action, user, changes)
    return case


@router.get("")
def get_cases(
    status: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    limit: Optional[int] = Query(None, ge=1, le=100),
    offset: Optional[int] = Query(None, ge=0),
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    """Return the documented case collection envelope."""
    page_size = limit or pageSize
    if offset is not None:
        page = (offset // page_size) + 1

    query = db.query(Case)
    states = case_sort_state_values(status or state)
    if states:
        query = query.filter(Case.state.in_(states))
    else:
        query = query.filter(Case.state.in_([CaseState.NEW.value, CaseState.ACCEPTED.value, CaseState.ESCALATED.value]))
    if severity:
        query = query.filter(Case.severity == severity.upper())

    total = query.count()
    rows = query.order_by(Case.priority.asc(), Case.created_at.asc()).offset((page - 1) * page_size).limit(page_size).all()
    items = [build_queue_item(db, case) for case in rows]
    dedup_stats = calculate_dedup_stats(db, db.query(Anomaly).count(), db.query(Case).count())

    return {
        "items": items,
        "cases": items,
        "page": page,
        "pageSize": page_size,
        "limit": page_size,
        "total": total,
        "dedupStats": dedup_stats,
        "dedup_stats": dedup_stats,
    }


@router.post("/trigger-detection")
def trigger_detection(
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    """Manually trigger detection & correlation cycle on demand."""
    from app.detection.service import run_detection_cycle
    return run_detection_cycle(db, z_threshold=2.0, limit=500)


@router.get("/{case_id}")
def get_case_detail(
    case_id: str,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    """Return the case-detail read model used by the investigation screen."""
    return build_case_detail(db, get_case_or_404(db, case_id))


@router.post("/{case_id}/action")
def act_on_case(
    case_id: str,
    request: CaseActionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Apply a reviewer decision and resolve the case."""
    decision = (request.decision or "ACCEPTED").upper()
    if decision not in {"ACCEPTED", "REJECTED", "MODIFIED"}:
        raise HTTPException(status_code=400, detail="decision must be ACCEPTED, REJECTED, or MODIFIED")
    if decision in {"REJECTED", "MODIFIED"} and not (request.rationale or request.note):
        raise HTTPException(status_code=400, detail="rationale is required for REJECTED or MODIFIED decisions")

    case = get_case_or_404(db, case_id)
    if case.state == CaseState.ESCALATED.value and current_user.role != "TEAM_LEAD":
        raise HTTPException(status_code=403, detail="Only Team Lead can resolve escalated cases")

    try:
        target = CaseState.RESOLVED.value if case.state != CaseState.NEW.value else CaseState.ACCEPTED.value
        note_text = request.rationale or request.note or ""
        if target == CaseState.ACCEPTED.value:
            transition_case(
                db, case, current_user, target, "CASE_ACKNOWLEDGED", request.version,
                note=note_text, category=request.category,
                verification_methods=request.verification_methods,
                follow_up_action=request.follow_up_action,
            )
            transition_case(
                db, case, current_user, CaseState.RESOLVED.value, f"CASE_{decision}", case.version,
                note=note_text, category=request.category,
                verification_methods=request.verification_methods,
                follow_up_action=request.follow_up_action,
            )
        else:
            transition_case(
                db, case, current_user, CaseState.RESOLVED.value, f"CASE_{decision}", request.version,
                note=note_text, category=request.category,
                verification_methods=request.verification_methods,
                follow_up_action=request.follow_up_action,
            )
        kb_entry = generate_kb_entry_from_case(case, db)
        if not db.query(KnowledgeBase).filter(KnowledgeBase.case_id == case.case_id).first():
            db.add(KnowledgeBase(case_id=case.case_id, title=kb_entry["title"], content=kb_entry["content"]))
        db.commit()
        db.refresh(case)
        return build_case_detail(db, case)
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        logger.error("Case action failed for %s: %s", case_id, exc)
        raise HTTPException(status_code=500, detail="Internal server error") from exc


@router.post("/{case_id}/escalate")
def escalate_case(
    case_id: str,
    request: CaseEscalateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Escalate a case with a reviewer-provided reason."""
    reason = request.reason or request.note or ""
    if len(reason.strip()) < 10:
        raise HTTPException(status_code=400, detail="Escalation reason must be at least 10 characters")
    case = get_case_or_404(db, case_id)
    try:
        transition_case(
            db, case, current_user, CaseState.ESCALATED.value, "CASE_ESCALATED", request.version,
            note=reason, category=request.category,
            verification_methods=request.verification_methods,
            follow_up_action="ESCALATE_FOR_APPROVAL",
        )
        db.commit()
        db.refresh(case)
        return build_case_detail(db, case)
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        logger.error("Case escalation failed for %s: %s", case_id, exc)
        raise HTTPException(status_code=500, detail="Internal server error") from exc


@router.post("/{case_id}/accept")
def accept_case(case_id: str, request: CaseActionRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    case = get_case_or_404(db, case_id)
    try:
        transition_case(
            db, case, current_user, CaseState.ACCEPTED.value, "CASE_ACKNOWLEDGED", request.version,
            note=request.rationale or request.note or "",
            category=request.category,
            verification_methods=request.verification_methods,
            follow_up_action=request.follow_up_action,
        )
        db.commit()
        db.refresh(case)
        return build_case_detail(db, case)
    except HTTPException:
        db.rollback()
        raise


@router.post("/{case_id}/resolve")
def resolve_case(case_id: str, request: CaseActionRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return act_on_case(case_id, CaseActionRequest(version=request.version, decision="ACCEPTED", rationale=request.note), db, current_user)
