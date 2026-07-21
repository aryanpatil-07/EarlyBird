#!/usr/bin/env python3
"""
Load Kaggle Credit Card Fraud dataset into PostgreSQL.

Usage:
    python scripts/load_kaggle_dataset.py <csv_path> [limit]
    
Example:
    python scripts/load_kaggle_dataset.py data/creditcard.csv 10000

This script:
1. Reads the Kaggle creditcard.csv file
2. Maps columns: Time -> timestamp, Amount -> amount, Class -> label
3. Creates entities for each unique card_id
4. Inserts transactions into PostgreSQL
5. Prints row counts and sample rows
"""

import sys
import os
from pathlib import Path
from datetime import datetime, timedelta
import pandas as pd
import json
import hashlib

# Add backend to path so we can import app modules
backend_path = Path(__file__).parent.parent / "backend"
sys.path.insert(0, str(backend_path))

from app.database import SessionLocal, engine
from app.models import Base, Entity, Transaction
from sqlalchemy import text

def hash_card_id(index):
    """Generate a deterministic but obfuscated card ID from index."""
    return f"CARD_{hashlib.md5(str(index).encode()).hexdigest()[:12].upper()}"

def load_kaggle_dataset(csv_path: str, limit: int = 10000):
    """Load Kaggle dataset into PostgreSQL."""
    
    print(f"[*] Loading Kaggle dataset from: {csv_path}")
    print(f"[*] Limit: {limit} rows")
    
    # Check file exists
    if not os.path.exists(csv_path):
        print(f"[!] Error: {csv_path} not found")
        sys.exit(1)
    
    # Read CSV
    print("[*] Reading CSV...")
    df = pd.read_csv(csv_path, nrows=limit)
    print(f"[*] Loaded {len(df)} rows from CSV")
    print(f"[*] Columns: {list(df.columns)}")
    
    # Get database session
    db = SessionLocal()
    
    try:
        # Initialize database schema if needed
        print("[*] Ensuring database schema exists...")
        Base.metadata.create_all(bind=engine)
        
        # Clear existing transactions and entities (fresh load)
        print("[*] Clearing existing transactions and entities...")
        db.execute(text("DELETE FROM transactions"))
        db.execute(text("DELETE FROM entities"))
        db.commit()
        
        # Create entities (one per unique card)
        print("[*] Creating card entities...")
        unique_cards = set()
        for idx in df.index:
            card_id = hash_card_id(idx % 1000)  # Group cards by mod 1000 to keep unique count manageable
            unique_cards.add(card_id)
        
        entities = []
        for card_id in sorted(unique_cards):
            entity = Entity(
                entity_type="card",
                entity_identifier=card_id
            )
            entities.append(entity)
        
        db.bulk_save_objects(entities)
        db.commit()
        print(f"[+] Created {len(entities)} card entities")
        
        # Insert transactions
        print("[*] Inserting transactions...")
        
        # Base timestamp: Jan 1, 2024
        base_timestamp = datetime(2024, 1, 1, 0, 0, 0)
        
        transactions = []
        for idx, row in df.iterrows():
            # Time column is seconds since base time
            # Calculate timestamp from Time value
            time_delta = timedelta(seconds=int(row['Time']))
            timestamp = base_timestamp + time_delta
            
            # Generate transaction ID
            transaction_id = f"TX_{idx:07d}"
            
            # Get card ID
            card_id = hash_card_id(idx % 1000)
            
            # Create transaction
            tx = Transaction(
                transaction_id=transaction_id,
                card_id=card_id,
                merchant_id=None,  # Not provided in Kaggle dataset
                amount=float(row['Amount']),
                timestamp=timestamp,
                label=int(row['Class']),  # 0 = legitimate, 1 = fraud
            )
            transactions.append(tx)
        
        db.bulk_save_objects(transactions)
        db.commit()
        print(f"[+] Inserted {len(transactions)} transactions")
        
        # Verify counts
        print("\n[*] Verification:")
        tx_count = db.query(Transaction).count()
        entity_count = db.query(Entity).count()
        fraud_count = db.query(Transaction).filter(Transaction.label == 1).count()
        legit_count = db.query(Transaction).filter(Transaction.label == 0).count()
        
        print(f"  - Total transactions: {tx_count}")
        print(f"  - Total entities (cards): {entity_count}")
        print(f"  - Fraudulent: {fraud_count} ({100*fraud_count/tx_count:.2f}%)")
        print(f"  - Legitimate: {legit_count} ({100*legit_count/tx_count:.2f}%)")
        
        # Show sample rows
        print("\n[*] Sample transactions:")
        samples = db.query(Transaction).limit(5).all()
        for tx in samples:
            label_str = "FRAUD" if tx.label == 1 else "LEGIT"
            print(f"  {tx.transaction_id}: ${tx.amount:.2f} @ {tx.timestamp} [{label_str}] (Card: {tx.card_id})")
        
        print("\n[+] Dataset loaded successfully!")
        
    except Exception as e:
        print(f"[!] Error during load: {e}")
        db.rollback()
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python scripts/load_kaggle_dataset.py <csv_path> [limit]")
        print("Example: python scripts/load_kaggle_dataset.py data/creditcard.csv 10000")
        sys.exit(1)
    
    csv_path = sys.argv[1]
    limit = int(sys.argv[2]) if len(sys.argv) > 2 else 10000
    
    load_kaggle_dataset(csv_path, limit)
