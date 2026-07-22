"""
SLA auto-escalation logic for Case Workflow.

Runs every 1 minute as a background job.
Escalates cases that exceed the 2-hour SLA window without being RESOLVED or ESCALATED.
"""

from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models import Case, AuditLog
from app.cases.state_machine import CaseStateMachine, CaseState, InvalidStateTransitionException
import logging

logger = logging.getLogger(__name__)

# SLA window: 2 hours (in seconds)
SLA_WINDOW_SECONDS = 2 * 60 * 60


def check_sla_breaches(db: Session) -> dict:
    """
    Query cases that exceed SLA and auto-escalate them.
    
    A case is eligible for SLA escalation if:
    - created_at > 2 hours ago
    - state NOT IN (RESOLVED, ESCALATED)
    
    For each eligible case:
    - Transition to ESCALATED via state machine
    - Create audit log entry
    
    Args:
        db: SQLAlchemy session
        
    Returns:
        {
            "success": bool,
            "checked_count": int (cases checked),
            "escalated_count": int (cases escalated),
            "timestamp": str (ISO format),
            "error": str (if failed)
        }
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
        
        # Query cases that are still open beyond SLA window
        # NOT IN (RESOLVED, ESCALATED) = still in NEW or ACCEPTED
        cases_to_escalate = db.query(Case).filter(
            Case.created_at <= sla_cutoff,
            Case.state.in_([CaseState.NEW.value, CaseState.ACCEPTED.value])
        ).all()
        
        result["checked_count"] = len(cases_to_escalate)
        
        if len(cases_to_escalate) == 0:
            result["success"] = True
            result["escalated_count"] = 0
            return result
        
        # Process each case
        for case in cases_to_escalate:
            try:
                # Create state machine and attempt transition
                sm = CaseStateMachine(case.state)
                new_state = sm.validate_transition(CaseState.ESCALATED)
                
                # Update case
                case.state = new_state.value
                case.updated_at = now
                db.add(case)
                
                # Create audit log entry
                audit = AuditLog(
                    case_id=case.id,
                    action="escalate",
                    actor="system",
                    details={
                        "reason": "SLA breach (2-hour window exceeded)",
                        "old_state": sm.current_state.value,
                        "new_state": new_state.value,
                    },
                    timestamp=now,
                )
                db.add(audit)
                
                result["escalated_count"] += 1
                
            except InvalidStateTransitionException as e:
                logger.warning(
                    f"Cannot escalate case {case.id} (state={case.state}): {e}"
                )
                # Skip this case and continue
                continue
            except Exception as e:
                logger.error(f"Error escalating case {case.id}: {e}")
                # Skip this case and continue
                continue
        
        # Commit all changes
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
                f"Checked: {result['checked_count']}, "
                f"Escalated: {result['escalated_count']}"
            )
        else:
            logger.debug(
                f"[{result['timestamp']}] SLA escalation cycle complete. "
                f"No breaches detected."
            )
    else:
        logger.error(
            f"[{result['timestamp']}] SLA escalation cycle FAILED: {result['error']}"
        )
