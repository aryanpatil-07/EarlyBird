"""
SLA auto-escalation logic for Case Workflow.

Escalates cases that exceed their SLA deadline (or 2-hour default window) without being RESOLVED or ESCALATED.
"""

from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models import Case, AuditLog
from app.cases.state_machine import CaseStateMachine, CaseState, InvalidStateTransitionException
import logging

logger = logging.getLogger(__name__)

# Default SLA window: 2 hours (in seconds)
SLA_WINDOW_SECONDS = 2 * 60 * 60


def check_sla_breaches(db: Session) -> dict:
    """
    Query cases that exceed SLA and auto-escalate them idempotently.
    """
    result = {
        "success": False,
        "checked_count": 0,
        "escalated_count": 0,
        "timestamp": datetime.utcnow().isoformat(),
        "error": None,
    }
    
    try:
        now = datetime.utcnow()
        sla_cutoff = now - timedelta(seconds=SLA_WINDOW_SECONDS)
        
        # Query cases that are still open beyond SLA window or past explicit sla_deadline
        cases_to_escalate = db.query(Case).filter(
            Case.state.in_([CaseState.NEW.value, CaseState.ACKNOWLEDGED.value, CaseState.ACCEPTED.value]),
            (Case.created_at <= sla_cutoff) | (Case.sla_deadline <= now)
        ).all()
        
        result["checked_count"] = len(cases_to_escalate)
        
        if len(cases_to_escalate) == 0:
            result["success"] = True
            result["escalated_count"] = 0
            return result
        
        # Process each case
        for case in cases_to_escalate:
            try:
                old_state = case.state
                new_state = CaseStateMachine.validate_transition(old_state, CaseState.ESCALATED.value)
                
                case.state = new_state
                case.version += 1
                case.updated_at = now
                db.add(case)
                
                # Create audit log entry with reconciled fields
                audit = AuditLog(
                    entity_type="case",
                    entity_id=case.case_id,
                    action="STATE_CHANGE",
                    actor_id="SYSTEM",
                    actor_type="SYSTEM",
                    reason="SLA breach auto-escalation (deadline exceeded)",
                    changes={
                        "old_state": old_state,
                        "new_state": new_state,
                    },
                    created_at=now,
                )
                db.add(audit)
                
                result["escalated_count"] += 1
                
            except InvalidStateTransitionException as e:
                logger.warning(
                    f"Cannot escalate case {case.case_id} (state={case.state}): {e}"
                )
                continue
            except Exception as e:
                logger.error(f"Error escalating case {case.case_id}: {e}")
                continue
        
        db.commit()
        result["success"] = True
        return result
    
    except Exception as e:
        result["success"] = False
        result["error"] = str(e)
        db.rollback()
        logger.error(f"SLA escalation cycle failed: {e}")
        return result
    
    finally:
        db.close()


def sla_escalation_callback():
    """
    APScheduler callback: run SLA escalation check and log result.
    """
    result = check_sla_breaches(SessionLocal())
    if result["success"]:
        if result["escalated_count"] > 0:
            logger.info(
                f"[{result['timestamp']}] SLA escalation cycle complete. "
                f"Checked: {result['checked_count']}, Escalated: {result['escalated_count']}"
            )
        else:
            logger.debug(
                f"[{result['timestamp']}] SLA escalation cycle complete. No breaches detected."
            )
    else:
        logger.error(
            f"[{result['timestamp']}] SLA escalation cycle FAILED: {result['error']}"
        )
