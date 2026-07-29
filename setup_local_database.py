#!/usr/bin/env python3
"""
Local database setup script - creates schema, seeds users and data without Docker.

Usage:
    python setup_local_database.py
"""

import os
import sys
from pathlib import Path
from datetime import datetime, timedelta
import json

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent / "backend"))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.models import Base, User, Entity, Transaction, PlaybookRule
from app.database import DATABASE_URL

import pandas as pd

def setup_database():
    """Set up the database schema."""
    print("[*] Setting up database...")
    
    # Create engine
    engine = create_engine(DATABASE_URL, echo=False)
    
    # Drop all tables
    print("[*] Dropping existing tables...")
    Base.metadata.drop_all(engine)
    
    # Create all tables
    print("[*] Creating new tables...")
    Base.metadata.create_all(engine)
    
    print("[OK] Database schema created")
    return engine

def seed_users(engine):
    """Seed initial users."""
    print("[*] Seeding users...")
    
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        users = [
            User(user_id="1", name="Reviewer Alex", role="REVIEWER", is_active=True),
            User(user_id="2", name="Team Lead Sarah", role="TEAM_LEAD", is_active=True),
        ]
        session.add_all(users)
        session.commit()
        print(f"[OK] Seeded {len(users)} users")
    finally:
        session.close()

def load_kaggle_dataset(engine, csv_path="data/creditcard.csv", limit=10000):
    """Load Kaggle dataset into PostgreSQL."""
    print(f"[*] Loading Kaggle dataset from {csv_path}...")
    
    if not Path(csv_path).exists():
        print(f"[!] Error: {csv_path} not found")
        return False
    
    # Read CSV
    df = pd.read_csv(csv_path, nrows=limit)
    print(f"[*] Loaded {len(df)} rows from CSV")
    
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        # Create entities for unique card IDs
        print("[*] Creating card entities...")
        unique_card_ids = df['Time'].unique()[:10]  # Use Time as pseudo card ID for uniqueness
        entities = []
        for i, card_id in enumerate(unique_card_ids):
            entity = Entity(
                entity_type="card",
                entity_identifier=f"CARD_{i+1}"
            )
            entities.append(entity)
        
        session.add_all(entities)
        session.commit()
        print(f"[OK] Created {len(entities)} card entities")
        
        # Insert transactions
        print(f"[*] Inserting {len(df)} transactions...")
        transactions = []
        base_date = datetime(2024, 1, 1)
        
        for idx, row in df.iterrows():
            # Map Kaggle columns to our schema
            # Time is seconds since some baseline, Map to dates in Jan 2024
            days_offset = int((row['Time'] / 86400) % 365)
            timestamp = base_date + timedelta(days=days_offset, seconds=int(row['Time'] % 86400))
            
            tx = Transaction(
                transaction_id=f"TX_{idx+1}",
                card_id=f"CARD_{(idx % 10) + 1}",
                merchant_id=f"MERCHANT_{(idx % 100) + 1}",
                amount=float(row['Amount']),
                timestamp=timestamp,
                label=int(row['Class']),  # 0 = legit, 1 = fraud
            )
            transactions.append(tx)
            
            if (idx + 1) % 1000 == 0:
                print(f"  {idx + 1}/{len(df)} transactions processed...")
        
        session.add_all(transactions)
        session.commit()
        print(f"[OK] Inserted {len(transactions)} transactions")
        
        # Verify
        tx_count = session.query(Transaction).count()
        fraud_count = session.query(Transaction).filter(Transaction.label == 1).count()
        print(f"[*] Verification: {tx_count} total, {fraud_count} fraud ({100*fraud_count/tx_count:.2f}%)")
        
        return True
    except Exception as e:
        print(f"[!] Error loading data: {e}")
        session.rollback()
        return False
    finally:
        session.close()

def seed_playbook_rules(engine):
    """Seed playbook rules from fixture."""
    print("[*] Seeding playbook rules...")
    
    fixture_path = Path("backend/fixtures/seed_playbook_rules.json")
    if not fixture_path.exists():
        print(f"[!] Fixture not found: {fixture_path}")
        return False
    
    with open(fixture_path) as f:
        rules_data = json.load(f)
    
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        rules = []
        for idx, rule_data in enumerate(rules_data):
            rule = PlaybookRule(
                name=rule_data.get('name', f'Rule {idx+1}'),
                description=rule_data.get('description'),
                condition_json=rule_data.get('condition_json', {}),
                recommendation=rule_data.get('recommendation', ''),
                priority=rule_data.get('priority', 5),
                enabled=1,
                created_by_id=2,  # Team Lead
            )
            rules.append(rule)
        
        session.add_all(rules)
        session.commit()
        print(f"[OK] Seeded {len(rules)} playbook rules")
        return True
    except Exception as e:
        print(f"[!] Error seeding rules: {e}")
        session.rollback()
        return False
    finally:
        session.close()

def main():
    """Main setup flow."""
    print("=" * 60)
    print("EarlyBird Local Database Setup")
    print("=" * 60)
    print()
    
    try:
        # Setup database
        engine = setup_database()
        print()
        
        # Seed users
        seed_users(engine)
        print()
        
        # Load Kaggle dataset
        if not load_kaggle_dataset(engine, "data/creditcard.csv", 10000):
            print("[!] Failed to load dataset")
            return False
        print()
        
        # Seed playbook rules
        if not seed_playbook_rules(engine):
            print("[!] Failed to seed rules")
            return False
        print()
        
        print("=" * 60)
        print("[OK] Database setup complete!")
        print("=" * 60)
        print()
        print("Next steps:")
        print("1. Start backend: python -m uvicorn app.main:app --reload --cwd backend")
        print("2. Test endpoints: curl http://localhost:8000/health")
        print("3. Open frontend: http://localhost:3000")
        print()
        
        return True
    except Exception as e:
        print(f"[!] Setup failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
