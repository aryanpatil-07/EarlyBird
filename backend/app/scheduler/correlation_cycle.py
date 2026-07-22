"""
Correlation cycle: background job running after detection cycle.

Queries all anomalies without root_cause_links, applies correlation rules,
populates root_cause_links table.
Runs independently via APScheduler.
"""

from datetime import datetime
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models import Anomaly, RootCauseLink
from app.root_cause.correlator import populate_root_cause_links_for_anomaly


def run_correlation_cycle() -> dict:
    """
    Run one correlation cycle: correlate all uncorrelated anomalies.
    
    Returns:
        {
            "success": bool,
            "total_anomalies": int,
            "processed": int (anomalies that had correlation links created),
            "links_created": int (total root_cause_links inserted),
            "timestamp": str (ISO format),
            "error": str (if failed)
        }
    """
    db = SessionLocal()
    result = {
        "success": False,
        "total_anomalies": 0,
        "processed": 0,
        "links_created": 0,
        "timestamp": datetime.utcnow().isoformat(),
        "error": None,
    }
    
    try:
        # Get all anomalies
        all_anomalies = db.query(Anomaly).all()
        result["total_anomalies"] = len(all_anomalies)
        
        if len(all_anomalies) == 0:
            result["success"] = True
            return result
        
        # Process each anomaly: check if it already has root_cause_links
        for anomaly in all_anomalies:
            existing_links_count = db.query(RootCauseLink).filter(
                RootCauseLink.anomaly_id == anomaly.id
            ).count()
            
            if existing_links_count == 0:
                # Run correlation for this anomaly
                new_links = populate_root_cause_links_for_anomaly(
                    anomaly.id,
                    db,
                    window_hours=24
                )
                
                if new_links > 0:
                    result["processed"] += 1
                    result["links_created"] += new_links
        
        result["success"] = True
        return result
    
    except Exception as e:
        result["success"] = False
        result["error"] = str(e)
        db.rollback()
        return result
    
    finally:
        db.close()


def correlation_cycle_callback():
    """
    APScheduler callback: run correlation cycle and log result.
    """
    result = run_correlation_cycle()
    
    if result["success"]:
        print(
            f"[{result['timestamp']}] Correlation cycle complete. "
            f"Total anomalies: {result['total_anomalies']}, "
            f"Processed: {result['processed']}, "
            f"Links created: {result['links_created']}"
        )
    else:
        print(
            f"[{result['timestamp']}] Correlation cycle FAILED: {result['error']}"
        )
