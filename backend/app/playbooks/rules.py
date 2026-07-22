"""Playbook rule management for Team Lead recommendations."""

import json
from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from app.models import PlaybookRule


def create_rule(
    session: Session,
    name: str,
    description: str,
    condition_json: Dict[str, Any],
    recommendation: str,
    priority: int = 5,
    created_by_id: int = None,
) -> PlaybookRule:
    """
    Create a new playbook rule.
    
    Args:
        session: Database session
        name: Human-readable rule name
        description: Explanation of rule
        condition_json: Condition object (matched by recommender)
        recommendation: Recommendation text
        priority: 1-10 priority level
        created_by_id: Team Lead user ID
    
    Returns:
        Created PlaybookRule instance
    """
    rule = PlaybookRule(
        name=name,
        description=description,
        condition_json=condition_json,
        recommendation=recommendation,
        priority=min(10, max(1, priority)),  # Clamp to 1-10
        enabled=1,
        created_by_id=created_by_id,
    )
    session.add(rule)
    session.commit()
    return rule


def list_enabled_rules(session: Session, order_by_priority: bool = True) -> List[PlaybookRule]:
    """
    List all enabled rules, optionally ordered by priority (descending).
    
    Args:
        session: Database session
        order_by_priority: If True, sort by priority DESC
    
    Returns:
        List of enabled PlaybookRule instances
    """
    query = session.query(PlaybookRule).filter(PlaybookRule.enabled == 1)
    
    if order_by_priority:
        query = query.order_by(PlaybookRule.priority.desc())
    
    return query.all()


def get_rule_by_id(session: Session, rule_id: int) -> Optional[PlaybookRule]:
    """Get a rule by ID."""
    return session.query(PlaybookRule).filter(PlaybookRule.id == rule_id).first()


def update_rule(
    session: Session,
    rule_id: int,
    name: str = None,
    description: str = None,
    condition_json: Dict[str, Any] = None,
    recommendation: str = None,
    priority: int = None,
    enabled: int = None,
) -> Optional[PlaybookRule]:
    """
    Update a rule. Only updates provided fields.
    
    Args:
        session: Database session
        rule_id: Rule ID to update
        name: Optional new name
        description: Optional new description
        condition_json: Optional new condition
        recommendation: Optional new recommendation
        priority: Optional new priority
        enabled: Optional enabled flag (1 or 0)
    
    Returns:
        Updated PlaybookRule or None if not found
    """
    rule = session.query(PlaybookRule).filter(PlaybookRule.id == rule_id).first()
    
    if not rule:
        return None
    
    if name is not None:
        rule.name = name
    if description is not None:
        rule.description = description
    if condition_json is not None:
        rule.condition_json = condition_json
    if recommendation is not None:
        rule.recommendation = recommendation
    if priority is not None:
        rule.priority = min(10, max(1, priority))
    if enabled is not None:
        rule.enabled = 1 if enabled else 0
    
    session.commit()
    return rule


def disable_rule(session: Session, rule_id: int) -> Optional[PlaybookRule]:
    """Soft-delete a rule by setting enabled=0."""
    return update_rule(session, rule_id, enabled=0)


def delete_rule(session: Session, rule_id: int) -> bool:
    """Hard-delete a rule from database."""
    rule = session.query(PlaybookRule).filter(PlaybookRule.id == rule_id).first()
    
    if not rule:
        return False
    
    session.delete(rule)
    session.commit()
    return True
