"""
High-Volume Load Test & Performance Simulation Script.

Simulates 5,000 credit card transactions across 100 entity cards, measures:
1. Batch transaction ingestion throughput.
2. EWMA detection engine scoring latency & throughput (transactions/sec).
3. Root Cause correlation engine latency (anomalies/sec).
4. Case creation & de-duplication latency.
5. Dashboard metrics endpoint performance (ms).
"""

import time
import random
from datetime import datetime, timedelta
from pathlib import Path
import sys

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import SessionLocal, engine
from app.models import Base, Transaction, Anomaly, Case, RootCauseLink, AuditLog, KnowledgeBase
from app.detection.service import run_detection_cycle
from app.root_cause.service import run_correlation_cycle
from app.cases.service import run_case_creation_cycle
from app.dashboard.service import get_dashboard_metrics


def run_load_simulation(num_cards: int = 100, txs_per_card: int = 50):
    total_txs = num_cards * txs_per_card
    print("=" * 70)
    print(f"EarlyBird — High-Volume Performance & Load Simulation")
    print(f"Target: {total_txs} transactions across {num_cards} unique entity cards")
    print("=" * 70)

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # Clean existing records
        print("\n[*] Clearing database tables for clean benchmark...")
        db.query(KnowledgeBase).delete()
        db.query(AuditLog).delete()
        db.query(RootCauseLink).delete()
        db.query(Case).delete()
        db.query(Anomaly).delete()
        db.query(Transaction).delete()
        db.commit()

        # Step 1: Generate Synthetic Transactions
        print(f"\n[*] Step 1: Ingesting {total_txs} transactions...")
        start_ingest = time.perf_counter()
        now = datetime.utcnow()
        batch = []

        for card_idx in range(num_cards):
            card_id = f"card_load_{card_idx:04d}"
            base_amount = random.uniform(20.0, 150.0)

            for tx_idx in range(txs_per_card):
                # Introduce a spike anomaly on transaction #45 for each card
                is_spike = (tx_idx == 45)
                amount = base_amount * random.uniform(15.0, 30.0) if is_spike else base_amount + random.gauss(0, 5.0)
                amount = max(1.0, amount)

                tx_time = now - timedelta(days=50 - tx_idx, minutes=random.randint(0, 59))
                batch.append(
                    Transaction(
                        transaction_id=f"tx_load_{card_idx:04d}_{tx_idx:04d}",
                        card_id=card_id,
                        merchant_id=f"merchant_{random.randint(1, 20)}",
                        amount=round(amount, 2),
                        timestamp=tx_time,
                        label=1 if is_spike else 0
                    )
                )

        db.add_all(batch)
        db.commit()
        ingest_duration = time.perf_counter() - start_ingest
        ingest_tps = total_txs / ingest_duration
        print(f"[OK] Ingestion Complete: {total_txs} records in {ingest_duration:.3f}s ({ingest_tps:.1f} tx/sec)")

        # Step 2: Detection Engine Benchmark
        print("\n[*] Step 2: Running EWMA Detection Engine Benchmark...")
        start_det = time.perf_counter()
        det_summary = run_detection_cycle(db, z_threshold=3.0, limit=10000)
        det_duration = time.perf_counter() - start_det
        det_tps = total_txs / det_duration
        print(f"[OK] Detection Engine: processed {det_summary['processed_transactions']} txs in {det_duration:.3f}s ({det_tps:.1f} tx/sec)")
        print(f"     Anomalies Flagged: {det_summary['anomalies_detected']}")

        # Step 3: Root Cause Correlation Engine Benchmark
        print("\n[*] Step 3: Running Root Cause Correlation Engine Benchmark...")
        start_rca = time.perf_counter()
        rca_summary = run_correlation_cycle(db)
        rca_duration = time.perf_counter() - start_rca
        print(f"[OK] Correlation Engine: evaluated {rca_summary['anomalies_evaluated']} anomalies in {rca_duration:.3f}s")
        print(f"     Root Cause Links Created: {rca_summary['links_created']}")

        # Step 4: Case Creation & Deduplication Benchmark
        print("\n[*] Step 4: Running Case Creation & Deduplication Benchmark...")
        start_cases = time.perf_counter()
        case_summary = run_case_creation_cycle(db)
        case_duration = time.perf_counter() - start_cases
        print(f"[OK] Case Engine: processed {case_summary['unlinked_anomalies']} anomalies in {case_duration:.3f}s")
        print(f"     Cases Created: {case_summary['created_count']}, Merged: {case_summary['merged_count']}")

        # Step 5: Dashboard Metrics Benchmark
        print("\n[*] Step 5: Benchmarking Dashboard Metrics Calculation...")
        start_metrics = time.perf_counter()
        metrics = get_dashboard_metrics(db)
        metrics_duration = (time.perf_counter() - start_metrics) * 1000.0
        print(f"[OK] Dashboard Metrics Calculated in {metrics_duration:.2f}ms")
        print(f"     MTTD: {metrics.get('mttdSeconds')}s | MTTR: {metrics.get('mttrSeconds')}s | Dedup Rate: {metrics.get('deduplicationRate')}% | KB Coverage: {metrics.get('documentationCoverage')}%")

        print("\n" + "=" * 70)
        print("Performance Simulation Results Summary:")
        print(f"  • Total Transactions:   {total_txs}")
        print(f"  • Detection Latency:    {det_duration:.3f}s ({det_tps:.1f} tx/sec)")
        print(f"  • Correlation Latency:  {rca_duration:.3f}s")
        print(f"  • Case Engine Latency:  {case_duration:.3f}s")
        print(f"  • Dashboard Response:   {metrics_duration:.2f}ms (Target < 100ms)")
        print("=" * 70)

    finally:
        db.close()


if __name__ == "__main__":
    run_load_simulation(num_cards=100, txs_per_card=50)
