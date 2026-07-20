"""
Script to load Kaggle Credit Card Fraud Dataset into EarlyBird database.

Phase 0: Data loading for initial setup.

Usage:
    python load_kaggle_dataset.py <path_to_csv>

The script:
1. Reads CSV file
2. Parses transactions
3. Inserts into PostgreSQL transactions table
4. Prints summary statistics
"""

import sys
import os
import csv
from datetime import datetime, timedelta
import random
from pathlib import Path

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from app.models import Transaction
from app.database import SessionLocal, engine, init_db


def load_dataset(csv_path: str, sample_size: int = None):
    """Load Kaggle dataset into database."""
    
    if not os.path.exists(csv_path):
        print(f"Error: File not found: {csv_path}")
        sys.exit(1)

    # Initialize database
    print("Initializing database schema...")
    init_db()
    print("Database initialized.")

    db = SessionLocal()
    
    try:
        print(f"\nLoading dataset from: {csv_path}")
        
        row_count = 0
        inserted_count = 0
        error_count = 0
        base_date = datetime(2024, 1, 1)
        
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            
            if not reader.fieldnames:
                print("Error: CSV file is empty")
                return
            
            print(f"CSV columns: {reader.fieldnames}")
            
            for row in reader:
                row_count += 1
                
                # Skip header or empty rows
                if row_count == 1 or not row.get('Time'):
                    continue
                
                # Optional: sample if sample_size specified
                if sample_size and row_count > sample_size:
                    break
                
                try:
                    # Parse Kaggle dataset columns
                    time_seconds = int(float(row.get('Time', 0)))
                    amount = float(row.get('Amount', 0))
                    label = int(float(row.get('Class', 0)))
                    
                    # Generate realistic timestamp
                    transaction_timestamp = base_date + timedelta(seconds=time_seconds)
                    
                    # Create transaction
                    transaction = Transaction(
                        transaction_id=f"TXN-{row_count:08d}",
                        card_id=f"CARD-{random.randint(1000000, 9999999):07d}",
                        merchant_id=f"MERCH-{random.randint(1, 10000):05d}",
                        amount=amount,
                        timestamp=transaction_timestamp,
                        label=label
                    )
                    
                    db.add(transaction)
                    inserted_count += 1
                    
                    # Batch commit every 1000 rows
                    if inserted_count % 1000 == 0:
                        db.commit()
                        print(f"  Inserted {inserted_count} transactions...")
                    
                except Exception as e:
                    error_count += 1
                    if error_count <= 5:  # Print first 5 errors
                        print(f"  Error on row {row_count}: {e}")
                    continue
        
        # Final commit
        db.commit()
        
        print(f"\n=== Dataset Loading Summary ===")
        print(f"Total rows processed: {row_count}")
        print(f"Transactions inserted: {inserted_count}")
        print(f"Errors: {error_count}")
        
        # Print statistics
        fraud_count = db.query(Transaction).filter(Transaction.label == 1).count()
        legit_count = db.query(Transaction).filter(Transaction.label == 0).count()
        total = fraud_count + legit_count
        
        print(f"\n=== Data Statistics ===")
        print(f"Total transactions: {total}")
        print(f"Fraudulent: {fraud_count} ({100*fraud_count/total:.2f}%)")
        print(f"Legitimate: {legit_count} ({100*legit_count/total:.2f}%)")
        
        # Sample a few transactions
        print(f"\n=== Sample Transactions ===")
        samples = db.query(Transaction).limit(3).all()
        for tx in samples:
            print(f"  {tx.transaction_id}: Card {tx.card_id}, Amount ${tx.amount:.2f}, Timestamp {tx.timestamp}, Label {tx.label}")
        
        print("\n✓ Dataset loaded successfully!")
        
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python load_kaggle_dataset.py <path_to_csv> [sample_size]")
        print("\nExample:")
        print("  python load_kaggle_dataset.py ../data/creditcard.csv")
        print("  python load_kaggle_dataset.py ../data/creditcard.csv 10000  (load first 10000 rows)")
        sys.exit(1)
    
    csv_path = sys.argv[1]
    sample_size = int(sys.argv[2]) if len(sys.argv) > 2 else None
    
    load_dataset(csv_path, sample_size)
