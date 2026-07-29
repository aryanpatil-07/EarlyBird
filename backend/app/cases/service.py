"""
Case domain service — Transactional case creation, de-duplication, state transitions, and atomic resolution.
"""

from datetime import datetime, timedelta
import uuid
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from app.models import Case, Anomaly, AuditLog, KnowledgeBase, PlaybookRule
from app.cases.state_machine import CaseStateMachine, CaseState, InvalidStateTransitionException


def create_or_dedup_case(
    db: Session,
    anomaly_id: int,
    entity_id: str,
    severity: str = "HIGH",
    metric: str = "amount",
    recommendations: Optional[List[Dict[str, Any]]] = None,
    window_minutes: int = 30
) -> Case:
    """
    Create a new case for an anomaly, or merge into an existing open case for the same entity within window.
    """
    now = datetime.utcnow()
    cutoff_time = now - timedelta(minutes=window_minutes)

    # Check for existing open case for same entity within window
    existing_case = (
        db.query(Case)
        .join(Anomaly, Case.anomaly_id == Anomaly.id, isouter=True)
        .filter(
            Case.state.in_([CaseState.NEW.value, CaseState.ACKNOWLEDGED.value, CaseState.ACCEPTED.value]),
            (Anomaly.entity_id == entity_id) | (Case.case_id.contains(entity_id)),
            Case.created_at >= cutoff_time
        )
        .order_by(Case.created_at.desc())
        .first()
    )

    if existing_case:
        existing_case.duplicate_count += 1
        existing_case.updated_at = now
        existing_case.version += 1
        
        audit = AuditLog(
            entity_type="case",
            entity_id=existing_case.case_id,
            action="DEDUP_MERGE",
            actor_id="SYSTEM",
            actor_type="SYSTEM",
            reason=f"Merged duplicate anomaly (ID {anomaly_id}) for entity {entity_id}",
            changes={"duplicate_count": existing_case.duplicate_count},
            created_at=now
        )
        db.add(existing_case)
        db.add(audit)
        db.commit()
        db.refresh(existing_case)
        return existing_case

    # Create new case
    case_number = uuid.uuid4().hex[:8].upper()
    new_case_id = f"CASE-{case_number}"
    
    # Calculate SLA deadline (2 hours for HIGH, 6 for MEDIUM, 24 for LOW)
    sla_hours = 2 if severity == "HIGH" else (6 if severity == "MEDIUM" else 24)
    sla_deadline = now + timedelta(hours=sla_hours)

    case = Case(
        case_id=new_case_id,
        anomaly_id=anomaly_id,
        state=CaseState.NEW.value,
        severity=severity,
        priority=1 if severity == "HIGH" else (2 if severity == "MEDIUM" else 3),
        sla_deadline=sla_deadline,
        duplicate_count=1,
        version=1,
        recommendations=recommendations or [],
        created_at=now,
        updated_at=now
    )
    db.add(case)
    db.flush()  # populate case.id

    audit = AuditLog(
        entity_type="case",
        entity_id=case.case_id,
        action="CREATE",
        actor_id="SYSTEM",
        actor_type="SYSTEM",
        reason=f"Case created from anomaly {anomaly_id} for entity {entity_id}",
        changes={"state": case.state, "severity": case.severity},
        created_at=now
    )
    db.add(audit)
    db.commit()
    db.refresh(case)
    return case


def transition_case_state(
    db: Session,
    case_id: str,
    new_state: str,
    actor_id: str,
    actor_type: str = "USER",
    reason: str = "",
    expected_version: Optional[int] = None
) -> Case:
    """
    Transition case state with optimistic concurrency check, state machine validation, and audit trail.
    If state transitions to RESOLVED, atomically generates Knowledge Base record.
    """
    case = db.query(Case).filter(Case.case_id == case_id).first()
    if not case:
        raise ValueError(f"Case {case_id} not found")

    if expected_version is not None and case.version != expected_version:
        raise ValueError(f"Stale state error: case version is {case.version}, expected {expected_version}")

    old_state = case.state
    validated_state = CaseStateMachine.validate_transition(old_state, new_state)

    now = datetime.utcnow()
    case.state = validated_state
    case.version += 1
    case.updated_at = now

    if validated_state == CaseState.RESOLVED.value:
        case.resolved_at = now

    db.add(case)

    # Audit log
    audit = AuditLog(
        entity_type="case",
        entity_id=case.case_id,
        action="STATE_CHANGE",
        actor_id=actor_id,
        actor_type=actor_type,
        reason=reason or f"State changed from {old_state} to {validated_state}",
        changes={"old_state": old_state, "new_state": validated_state},
        created_at=now
    )
    db.add(audit)

    # If resolving, generate Knowledge Base entry atomically in same transaction
    if validated_state == CaseState.RESOLVED.value:
        kb_title = f"Resolution Record — {case.case_id}"
        kb_content = (
            f"# Case Resolution: {case.case_id}\n\n"
            f"**Severity:** {case.severity}\n"
            f"**State:** RESOLVED\n"
            f"**Decision Reason:** {reason or 'No decision rationale provided'}\n"
            f"**Resolved By:** {actor_id}\n"
            f"**Resolved At:** {now.isoformat()}\n\n"
            f"## Summary\nCase {case.case_id} was investigated and marked as resolved by {actor_id}.\n"
        )
        kb = KnowledgeBase(
            case_id=case.case_id,
            title=kb_title,
            content=kb_content,
            summary=f"Resolved case {case.case_id} ({case.severity} severity)",
            root_cause_summary="Automated root cause correlation applied",
            decision_summary=reason or "Resolved",
            created_at=now
        )
        db.add(kb)

    db.commit()
    db.refresh(case)
    return case
