"""
Root cause correlator — finds related activity and populates root_cause_links.

Main entry point: run_correlation_for_anomaly()
"""

from datetime import datetime
from sqlalchemy.orm import Session
from app.models import Anomaly, RootCauseLink, Transaction
from app.root_cause.rules import CorrelationRules


def find_related_anomalies(
    anomaly_id: int,
    db: Session,
    window_hours: int = 24
) -> list[dict]:
    """
    Find all related transactions for an anomaly via correlation rules.
    
    Applies all three correlation rules (same_entity, same_merchant, amount_pattern)
    and returns related transaction IDs with link type.
    
    Args:
        anomaly_id: ID of the anomaly to correlate
        db: SQLAlchemy session
        window_hours: Correlation window (default 24 hours)
    
    Returns:
        List of dicts: [
            {
                "transaction_id": int,
                "link_type": str ("same_entity", "same_merchant", "amount_pattern"),
                "evidence": dict (rule-specific data)
            },
            ...
        ]
    """
    # Get the anomaly
    anomaly = db.query(Anomaly).filter(Anomaly.id == anomaly_id).first()
    if not anomaly:
        return []
    
    related_list = []
    
    # Apply same_entity rule
    same_entity_results = CorrelationRules.same_entity_rule(anomaly, db, window_hours)
    for result in same_entity_results:
        # Get related anomaly if it exists
        related_anomaly = db.query(Anomaly).filter(
            Anomaly.transaction_id == result["transaction_id"]
        ).first()
        
        if related_anomaly:  # Only link if related tx also has an anomaly
            related_list.append({
                "related_anomaly_id": related_anomaly.id,
                "link_type": "same_entity",
                "evidence": result
            })
    
    # Apply same_merchant rule
    same_merchant_results = CorrelationRules.same_merchant_rule(anomaly, db, window_hours)
    for result in same_merchant_results:
        # Get related anomaly if it exists
        related_anomaly = db.query(Anomaly).filter(
            Anomaly.transaction_id == result["transaction_id"]
        ).first()
        
        if related_anomaly:  # Only link if related tx also has an anomaly
            related_list.append({
                "related_anomaly_id": related_anomaly.id,
                "link_type": "same_merchant",
                "evidence": result
            })
    
    # Apply amount_pattern rule
    amount_pattern_results = CorrelationRules.amount_pattern_rule(anomaly, db, window_hours)
    for result in amount_pattern_results:
        # Get related anomaly if it exists
        related_anomaly = db.query(Anomaly).filter(
            Anomaly.transaction_id == result["transaction_id"]
        ).first()
        
        if related_anomaly:  # Only link if related tx also has an anomaly
            related_list.append({
                "related_anomaly_id": related_anomaly.id,
                "link_type": "amount_pattern",
                "evidence": result
            })
    
    return related_list


def populate_root_cause_links_for_anomaly(
    anomaly_id: int,
    db: Session,
    window_hours: int = 24
) -> int:
    """
    Find related anomalies and populate root_cause_links table.
    
    Args:
        anomaly_id: ID of the anomaly to process
        db: SQLAlchemy session
        window_hours: Correlation window (default 24 hours)
    
    Returns:
        Number of root_cause_links created
    """
    # Find related anomalies
    related_list = find_related_anomalies(anomaly_id, db, window_hours)
    
    # Insert root_cause_links for each relationship (avoiding duplicates)
    inserted_count = 0
    for rel in related_list:
        # Check if link already exists
        existing_link = db.query(RootCauseLink).filter(
            RootCauseLink.anomaly_id == anomaly_id,
            RootCauseLink.related_anomaly_id == rel["related_anomaly_id"],
            RootCauseLink.link_type == rel["link_type"]
        ).first()
        
        if not existing_link:
            # Create new link
            link = RootCauseLink(
                anomaly_id=anomaly_id,
                related_anomaly_id=rel["related_anomaly_id"],
                link_type=rel["link_type"],
                evidence=rel["evidence"],
                created_at=datetime.utcnow()
            )
            db.add(link)
            inserted_count += 1
    
    # Commit all inserts
    if inserted_count > 0:
        db.commit()
    
    return inserted_count


def run_correlation_cycle(
    db: Session,
    window_hours: int = 24
) -> dict:
    """
    Main entry point: run correlation for all anomalies not yet processed.
    
    This is called by the scheduler after anomalies are created.
    
    Args:
        db: SQLAlchemy session
        window_hours: Correlation window (default 24 hours)
    
    Returns:
        {
            "processed": int (anomalies with links found),
            "links_created": int (total root_cause_links inserted),
            "timestamp": str (ISO format)
        }
    """
    # Get all anomalies
    all_anomalies = db.query(Anomaly).all()
    
    processed_count = 0
    links_created = 0
    
    for anomaly in all_anomalies:
        # Check if this anomaly already has correlation links
        existing_links = db.query(RootCauseLink).filter(
            RootCauseLink.anomaly_id == anomaly.id
        ).count()
        
        if existing_links == 0:
            # Run correlation for this anomaly
            new_links = populate_root_cause_links_for_anomaly(
                anomaly.id,
                db,
                window_hours=window_hours
            )
            if new_links > 0:
                processed_count += 1
                links_created += new_links
    
    return {
        "processed": processed_count,
        "links_created": links_created,
        "timestamp": datetime.utcnow().isoformat()
    }
