"""
Executable script to run a full detection -> correlation -> deduplication -> SLA cycle.
Verifies idempotency of Phase 1 domain services.
"""

import os
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import SessionLocal
from app.detection.service import run_detection_cycle
from app.cases.sla import check_sla_breaches
from app.models import Anomaly, Case, RootCauseLink, AuditLog, KnowledgeBase


def main():
    print("=" * 60)
    print("EarlyBird — Pipeline Cycle Runner (Phase 1 Verification)")
    print("=" * 60)

    db = SessionLocal()
    try:
        print("\n[*] Running Detection & Correlation Cycle (Pass 1)...")
        res1 = run_detection_cycle(db, z_threshold=3.0, limit=500)
        print(f"[OK] Pass 1 result: {res1}")

        print("\n[*] Running SLA Auto-Escalation Check...")
        sla_res = check_sla_breaches(db)
        print(f"[OK] SLA result: {sla_res}")

        anomalies_count1 = db.query(Anomaly).count()
        cases_count1 = db.query(Case).count()
        rcl_count1 = db.query(RootCauseLink).count()

        print(f"Stats after Pass 1: Anomalies={anomalies_count1}, Cases={cases_count1}, RootCauseLinks={rcl_count1}")

        print("\n[*] Running Idempotency Verification (Pass 2)...")
        res2 = run_detection_cycle(db, z_threshold=3.0, limit=500)
        print(f"[OK] Pass 2 result: {res2}")

        anomalies_count2 = db.query(Anomaly).count()
        cases_count2 = db.query(Case).count()

        if anomalies_count2 == anomalies_count1 and cases_count2 == cases_count1:
            print("\n[OK] Pipeline Idempotency VERIFIED! No duplicate anomalies or cases generated.")
        else:
            print(f"\n[!] WARNING: Counts changed! Anomalies {anomalies_count1}->{anomalies_count2}, Cases {cases_count1}->{cases_count2}")

    finally:
        db.close()

if __name__ == "__main__":
    main()
