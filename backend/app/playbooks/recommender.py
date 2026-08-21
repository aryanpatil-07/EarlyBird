"""Recommendation matching engine for playbook rules."""

from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.playbooks.rules import PlaybookRule, list_enabled_rules
from app.models import Case, Anomaly, Transaction, RootCauseLink


class Recommender:
    """
    Recommendation engine that evaluates enabled playbook rules against a case
    and returns matching recommendations sorted by priority.
    """
    
    @staticmethod
    def evaluate_rule_against_case(case: Case, rule: PlaybookRule, session: Optional[Session] = None) -> bool:
        """
        Evaluate a single rule condition against a case.
        
        Supports conditions:
        - entity_type: (str) "card" or "merchant"
        - amount_min: (float) minimum transaction amount
        - amount_max: (float) maximum transaction amount
        - amount: (dict) {"$gte": float, "$lte": float, "$gt": float, "$lt": float}
        - z_score / high_z_score / z_score_min: (float/dict) minimum z-score threshold
        - merchant_mismatch: (bool) true if case has merchant variation
        - rapid_multi_tx / velocity: (bool) true if multiple transactions in <1 hour
        - severity: (str) "HIGH", "MEDIUM", "LOW"
        
        All conditions are AND'd together (all must match to fire rule).
        """
        conditions = rule.condition_json or {}
        if not conditions:
            return True
        
        # Resolve anomaly and transaction
        anomaly = None
        if hasattr(case, "anomaly") and case.anomaly:
            anomaly = case.anomaly
        elif case.anomaly_id and session:
            anomaly = session.query(Anomaly).filter(Anomaly.id == case.anomaly_id).first()
        elif case.recommendations and isinstance(case.recommendations, dict) and session:
            anomaly_ids = case.recommendations.get("anomaly_ids") or []
            if anomaly_ids:
                anomaly = session.query(Anomaly).filter(Anomaly.id == anomaly_ids[0]).first()
        
        tx = None
        if anomaly:
            if hasattr(anomaly, "transaction") and anomaly.transaction:
                tx = anomaly.transaction
            elif anomaly.transaction_id and session:
                tx = session.query(Transaction).filter(Transaction.id == anomaly.transaction_id).first()

        # Extract metrics
        case_amount = 0.0
        if tx and tx.amount is not None:
            case_amount = float(tx.amount)
        elif anomaly and anomaly.observed_value is not None:
            case_amount = float(anomaly.observed_value)
        elif anomaly and anomaly.baseline is not None and anomaly.deviation is not None:
            case_amount = float(anomaly.baseline + anomaly.deviation)
        elif hasattr(case, "amount"):
            case_amount = float(getattr(case, "amount") or 0.0)

        case_score = 0.0
        if anomaly and anomaly.score is not None:
            case_score = float(anomaly.score)
        elif hasattr(case, "max_score"):
            case_score = float(getattr(case, "max_score") or 0.0)
        elif case.priority is not None:
            case_score = float(case.priority)

        case_severity = case.severity or "HIGH"
        duplicate_count = case.duplicate_count or 1

        # Check entity_type
        if "entity_type" in conditions:
            required_type = conditions["entity_type"]
            if hasattr(case, "entity_type") and case.entity_type != required_type:
                return False

        # Check amount_min
        if "amount_min" in conditions:
            if case_amount < float(conditions["amount_min"]):
                return False

        # Check amount_max
        if "amount_max" in conditions:
            if case_amount > float(conditions["amount_max"]):
                return False

        # Check amount dict operator
        if "amount" in conditions:
            cond_amount = conditions["amount"]
            if isinstance(cond_amount, dict):
                if "$gte" in cond_amount and case_amount < float(cond_amount["$gte"]):
                    return False
                if "$gt" in cond_amount and case_amount <= float(cond_amount["$gt"]):
                    return False
                if "$lte" in cond_amount and case_amount > float(cond_amount["$lte"]):
                    return False
                if "$lt" in cond_amount and case_amount >= float(cond_amount["$lt"]):
                    return False
            elif isinstance(cond_amount, (int, float)):
                if case_amount < float(cond_amount):
                    return False

        # Check high_z_score / z_score_min
        if "high_z_score" in conditions:
            if case_score < float(conditions["high_z_score"]):
                return False

        if "z_score_min" in conditions:
            if case_score < float(conditions["z_score_min"]):
                return False

        # Check z_score dict operator
        if "z_score" in conditions:
            cond_z = conditions["z_score"]
            if isinstance(cond_z, dict):
                if "$gte" in cond_z and case_score < float(cond_z["$gte"]):
                    return False
                if "$gt" in cond_z and case_score <= float(cond_z["$gt"]):
                    return False
                if "$lte" in cond_z and case_score > float(cond_z["$lte"]):
                    return False
                if "$lt" in cond_z and case_score >= float(cond_z["$lt"]):
                    return False
            elif isinstance(cond_z, (int, float)):
                if case_score < float(cond_z):
                    return False

        # Check severity
        if "severity" in conditions:
            if case_severity.upper() != str(conditions["severity"]).upper():
                return False

        # Check merchant mismatch
        if conditions.get("merchant_mismatch", False):
            has_merchant_var = getattr(case, "has_merchant_variation", False)
            if not has_merchant_var and anomaly and session:
                links = session.query(RootCauseLink).filter(RootCauseLink.anomaly_id == anomaly.id).all()
                has_merchant_var = any(l.link_type == "same_merchant" for l in links)
            if not has_merchant_var:
                return False

        # Check rapid_multi_tx
        if conditions.get("rapid_multi_tx", False) or conditions.get("velocity", False):
            has_rapid = getattr(case, "has_rapid_multi_tx", False) or duplicate_count > 1
            if not has_rapid and anomaly and session:
                links = session.query(RootCauseLink).filter(RootCauseLink.anomaly_id == anomaly.id).all()
                has_rapid = any(l.link_type in ["velocity_burst", "high_velocity", "same_entity"] for l in links)
            if not has_rapid:
                return False

        return True
    
    @staticmethod
    def get_recommendations(case: Case, session: Session) -> List[Dict[str, Any]]:
        """
        Get all matching recommendations for a case.
        
        Evaluates all enabled rules against the case, returns matches
        sorted by priority (highest first).
        """
        enabled_rules = list_enabled_rules(session, order_by_priority=True)
        
        recommendations = []
        for rule in enabled_rules:
            if Recommender.evaluate_rule_against_case(case, rule, session):
                recommendations.append({
                    "rule_id": rule.id,
                    "name": rule.name,
                    "recommendation": rule.recommendation,
                    "priority": rule.priority,
                })
        
        return recommendations
