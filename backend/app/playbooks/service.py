"""
Playbook domain service — Rule matching and recommendation evaluation.
"""

from typing import List, Dict, Any
from sqlalchemy.orm import Session
from app.models import PlaybookRule, Case, Anomaly


def get_matching_recommendations(db: Session, case_or_anomaly: Any) -> List[Dict[str, Any]]:
    """
    Evaluate all enabled playbook rules against a Case or Anomaly and return matching recommendations sorted by priority.
    """
    active_rules = (
        db.query(PlaybookRule)
        .filter(PlaybookRule.enabled == 1)
        .order_by(PlaybookRule.priority.asc(), PlaybookRule.id.asc())
        .all()
    )

    matches = []
    
    # Extract properties from case or anomaly
    observed_amount = getattr(case_or_anomaly, 'observed_value', getattr(case_or_anomaly, 'amount', 0))
    severity = getattr(case_or_anomaly, 'severity', 'HIGH')

    for rule in active_rules:
        cond = rule.condition_json or {}
        matches_rule = True

        if "amount_min" in cond and observed_amount < float(cond["amount_min"]):
            matches_rule = False
        if "amount_max" in cond and observed_amount > float(cond["amount_max"]):
            matches_rule = False
        if "severity" in cond and cond["severity"] != severity:
            matches_rule = False

        if matches_rule:
            matches.append({
                "rule_id": rule.id,
                "rule_name": rule.name,
                "recommendation": rule.recommendation,
                "priority": rule.priority,
                "condition": rule.condition_json
            })

    return matches
