"""Recommendation matching engine for playbook rules."""

from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.playbooks.rules import PlaybookRule, list_enabled_rules
from app.models import Case


class Recommender:
    """
    Recommendation engine that evaluates enabled playbook rules against a case
    and returns matching recommendations sorted by priority.
    """
    
    @staticmethod
    def evaluate_rule_against_case(case: Case, rule: PlaybookRule) -> bool:
        """
        Evaluate a single rule condition against a case.
        
        Supports conditions:
        - entity_type: (str) "card" or "merchant"
        - amount_min: (float) minimum transaction amount
        - amount_max: (float) maximum transaction amount
        - merchant_mismatch: (bool) true if case has merchant variation
        - rapid_multi_tx: (bool) true if multiple transactions in <1 hour
        - high_z_score: (float) minimum z-score threshold
        
        All conditions are AND'd together (all must match to fire rule).
        
        Args:
            case: Case instance to evaluate
            rule: PlaybookRule with condition_json
        
        Returns:
            True if all conditions match, False otherwise
        """
        conditions = rule.condition_json or {}
        
        # Check entity_type
        if "entity_type" in conditions:
            required_type = conditions["entity_type"]
            # Infer from case (this is a simplified check; in production,
            # you'd have case.entity_type from the model)
            if hasattr(case, "entity_type") and case.entity_type != required_type:
                return False
        
        # Check amount range
        case_amount = getattr(case, "amount", 0)
        if "amount_min" in conditions:
            if case_amount < conditions["amount_min"]:
                return False
        if "amount_max" in conditions:
            if case_amount > conditions["amount_max"]:
                return False
        
        # Check merchant mismatch (if case has merchant variation in root causes)
        if conditions.get("merchant_mismatch", False):
            # Check if root_cause_links has any "same_merchant" links
            # (simplified: case should have a flag or we compute it)
            if not getattr(case, "has_merchant_variation", False):
                return False
        
        # Check rapid_multi_tx (case has multiple transactions <1 hour)
        if conditions.get("rapid_multi_tx", False):
            if not getattr(case, "has_rapid_multi_tx", False):
                return False
        
        # Check high z-score threshold
        if "high_z_score" in conditions:
            case_score = getattr(case, "max_score", 0)
            if case_score < conditions["high_z_score"]:
                return False
        
        return True
    
    @staticmethod
    def get_recommendations(case: Case, session: Session) -> List[Dict[str, Any]]:
        """
        Get all matching recommendations for a case.
        
        Evaluates all enabled rules against the case, returns matches
        sorted by priority (highest first).
        
        Args:
            case: Case instance
            session: Database session
        
        Returns:
            List of dicts: {"rule_id": int, "name": str, "recommendation": str, "priority": int}
        """
        enabled_rules = list_enabled_rules(session, order_by_priority=True)
        
        recommendations = []
        for rule in enabled_rules:
            if Recommender.evaluate_rule_against_case(case, rule):
                recommendations.append({
                    "rule_id": rule.id,
                    "name": rule.name,
                    "recommendation": rule.recommendation,
                    "priority": rule.priority,
                })
        
        # Already sorted by priority DESC from list_enabled_rules
        return recommendations
