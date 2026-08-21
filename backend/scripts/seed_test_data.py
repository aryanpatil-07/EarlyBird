"""
Seed comprehensive test data into EarlyBird database.

Creates:
- Test users (REVIEWER, TEAM_LEAD)
- Sample transactions
- Sample anomalies
- Sample cases (various states)
- Sample root cause links
- Sample audit log entries

Usage:
    python -m scripts.seed_test_data
"""

import os
import sys
from datetime import datetime, timedelta
import random

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models import (
    User, Transaction, Anomaly, Case, RootCauseLink, 
    AuditLog, Entity, KnowledgeBase
)


def seed_users(session):
    """Create or verify test users."""
    users_data = [
        ("12345", "Team Lead 12345", "TEAM_LEAD"),
        ("67890", "Reviewer 67890", "REVIEWER"),
        ("system", "System User", "TEAM_LEAD"),
        ("1", "Reviewer Alex", "REVIEWER"),
        ("2", "Team Lead Sarah", "TEAM_LEAD"),
    ]
    user_map = {}
    for uid, name, role in users_data:
        u = session.query(User).filter(User.user_id == uid).first()
        if not u:
            u = User(user_id=uid, name=name, role=role, is_active=True)
            session.add(u)
            session.flush()
        user_map[uid] = u.id
    session.commit()
    print(f"[OK] Verified {len(users_data)} users")
    return user_map


def seed_transactions(session, count=50):
    """Create sample transactions."""
    session.query(Transaction).delete()
    session.commit()
    
    card_ids = [f"CARD-{i:04d}" for i in range(1, 6)]
    merchant_ids = [f"MERCHANT-{i:03d}" for i in range(1, 11)]
    
    transactions = []
    base_time = datetime.utcnow() - timedelta(days=7)
    
    for i in range(count):
        tx = Transaction(
            transaction_id=f"TXN-{i:06d}",
            card_id=random.choice(card_ids),
            merchant_id=random.choice(merchant_ids),
            amount=round(random.uniform(10, 5000), 2),
            timestamp=base_time + timedelta(hours=random.randint(0, 168)),
            label=random.choice([0, 0, 0, 0, 1]),  # 80% legitimate
            created_at=datetime.utcnow()
        )
        transactions.append(tx)
    
    session.add_all(transactions)
    session.commit()
    print(f"[OK] Seeded {len(transactions)} transactions")
    return transactions


def seed_anomalies(session, transactions):
    """Create sample anomalies from transactions."""
    session.query(Anomaly).delete()
    session.commit()
    
    anomalies = []
    
    # Create anomalies for about 20% of transactions
    sample_txs = random.sample(transactions, max(5, len(transactions) // 5))
    
    for i, tx in enumerate(sample_txs):
        anomaly = Anomaly(
            transaction_id=tx.id,
            score=round(random.uniform(2.5, 6.0), 2),  # z-score
            baseline=round(random.uniform(50, 200), 2),
            deviation=round(random.uniform(100, 500), 2),
            evidence={
                "reason": random.choice([
                    "High z-score deviation",
                    "Card testing pattern",
                    "Rapid multi-transaction",
                    "Merchant mismatch",
                    "Geographic anomaly"
                ]),
                "confidence": random.choice([0.7, 0.8, 0.85, 0.9, 0.95])
            },
            created_at=datetime.utcnow()
        )
        anomalies.append(anomaly)
    
    session.add_all(anomalies)
    session.commit()
    print(f"[OK] Seeded {len(anomalies)} anomalies")
    return anomalies


def seed_cases(session, anomalies):
    """Create sample cases from anomalies."""
    session.query(Case).delete()
    session.commit()
    
    states = ["NEW", "ACCEPTED", "RESOLVED", "ESCALATED"]
    severities = ["HIGH", "MEDIUM", "LOW"]
    
    cases = []
    base_time = datetime.utcnow() - timedelta(days=5)
    
    for i, anomaly in enumerate(anomalies[:len(anomalies)]):
        state = random.choice(states)
        resolved_at = None
        
        if state == "RESOLVED":
            resolved_at = base_time + timedelta(hours=random.randint(2, 48))
        
        case = Case(
            case_id=f"CASE-{i:05d}",
            state=state,
            severity=random.choice(severities),
            priority=random.randint(1, 5),
            version=random.randint(1, 3),
            recommendations=[
                {
                    "action": "Contact cardholder for verification",
                    "priority": "HIGH",
                    "sla_hours": 2
                },
                {
                    "action": "Review merchant and transaction details",
                    "priority": "MEDIUM",
                    "sla_hours": 4
                }
            ],
            created_at=base_time + timedelta(hours=random.randint(0, 120)),
            updated_at=base_time + timedelta(hours=random.randint(0, 120)),
            resolved_at=resolved_at
        )
        cases.append(case)
    
    session.add_all(cases)
    session.commit()
    print(f"[OK] Seeded {len(cases)} cases")
    return cases


def seed_root_cause_links(session, anomalies):
    """Create root cause links between anomalies."""
    session.query(RootCauseLink).delete()
    session.commit()
    
    if len(anomalies) < 2:
        print("[WARN] Not enough anomalies to create links (need 2+)")
        return []
    
    link_types = ["same_entity", "same_merchant", "amount_pattern", "time_window"]
    links = []
    
    # Create 3-5 links between anomalies
    num_links = random.randint(3, min(5, len(anomalies) - 1))
    
    for _ in range(num_links):
        anom_pair = random.sample(anomalies, 2)
        link = RootCauseLink(
            anomaly_id=anom_pair[0].id,
            related_anomaly_id=anom_pair[1].id,
            link_type=random.choice(link_types),
            evidence={
                "metric": random.choice([0.7, 0.8, 0.85, 0.9]),
                "reason": "Correlated pattern detected"
            },
            created_at=datetime.utcnow()
        )
        links.append(link)
    
    session.add_all(links)
    session.commit()
    print(f"[OK] Seeded {len(links)} root cause links")
    return links


def seed_audit_log(session, user_ids, cases):
    """Create audit log entries."""
    session.query(AuditLog).delete()
    session.commit()
    
    actions = ["CREATE", "UPDATE", "STATE_CHANGE", "ACCEPT", "RESOLVE", "ESCALATE"]
    logs = []
    base_time = datetime.utcnow() - timedelta(days=5)
    
    for i, case in enumerate(cases):
        # Create 2-4 audit entries per case
        num_logs = random.randint(2, 4)
        for j in range(num_logs):
            log = AuditLog(
                entity_type="case",
                entity_id=case.case_id,
                action=random.choice(actions),
                actor_id=random.choice(list(user_ids.keys())),
                changes={
                    "field": "state" if random.choice([True, False]) else "priority",
                    "old_value": "NEW" if random.choice([True, False]) else 5,
                    "new_value": "ACCEPTED" if random.choice([True, False]) else 3,
                },
                created_at=base_time + timedelta(hours=random.randint(0, 120) + j)
            )
            logs.append(log)
    
    session.add_all(logs)
    session.commit()
    print(f"[OK] Seeded {len(logs)} audit log entries")
    return logs


def seed_knowledge_base(session, cases):
    """Create knowledge base entries from resolved cases."""
    session.query(KnowledgeBase).delete()
    session.commit()
    
    resolved_cases = [c for c in cases if c.state == "RESOLVED"]
    kb_entries = []
    
    for case in resolved_cases:
        entry = KnowledgeBase(
            case_id=case.case_id,
            title=f"Pattern: Case {case.case_id}",
            content=f"""
# Case {case.case_id} Resolution

## Severity: {case.severity}
## Priority: {case.priority}

### Actions Taken
- Cardholder contacted and verified
- Unauthorized transactions identified
- Card replacement ordered

### Pattern Identified
This case represented a {case.severity.lower()} fraud indicator with the following characteristics:
- Multiple transactions in short time window
- Geographic mismatch from typical usage
- Merchant category deviation

### Outcome
Case resolved successfully. Cardholder informed and new card issued.

### Similar Cases
Related anomalies detected and correlated for pattern analysis.
            """.strip(),
            created_at=case.resolved_at or datetime.utcnow()
        )
        kb_entries.append(entry)
    
    session.add_all(kb_entries)
    session.commit()
    print(f"[OK] Seeded {len(kb_entries)} knowledge base entries")
    return kb_entries


def seed_all():
    """Seed all test data."""
    session = SessionLocal()
    
    try:
        print("\n" + "="*50)
        print("EarlyBird Test Data Seeding")
        print("="*50 + "\n")
        
        # Seed in dependency order
        user_ids = seed_users(session)
        transactions = seed_transactions(session, count=50)
        anomalies = seed_anomalies(session, transactions)
        cases = seed_cases(session, anomalies)
        links = seed_root_cause_links(session, anomalies)
        logs = seed_audit_log(session, user_ids, cases)
        kb = seed_knowledge_base(session, cases)
        
        print("\n" + "="*50)
        print("[OK] All test data seeded successfully!")
        print("="*50 + "\n")
        
        return True
    
    except Exception as e:
        session.rollback()
        print(f"\n[ERROR] Error seeding test data: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    finally:
        session.close()


if __name__ == "__main__":
    success = seed_all()
    sys.exit(0 if success else 1)
