#!/usr/bin/env python3
"""
Seed playbook rules into PostgreSQL from fixture file.

Usage:
    python scripts/seed_playbook_rules.py
"""

import sys
import os
import json
from pathlib import Path

# Add backend to path so we can import app modules
# Handle both local (project root) and Docker (/app) contexts
script_dir = Path(__file__).parent
possible_paths = [
    script_dir.parent / "backend",  # Local: scripts/../backend
    Path("/app"),                    # Docker: /app (app code at root)
    script_dir.parent,               # Docker volume mount: scripts/..
]

for path in possible_paths:
    if (path / "app" / "database.py").exists():
        sys.path.insert(0, str(path))
        break

from app.database import SessionLocal
from app.models import PlaybookRule
from sqlalchemy import text

def seed_playbook_rules():
    """Load playbook rules from fixture file into database."""
    
    # Possible fixture paths
    possible_fixture_paths = [
        Path("/app/app/fixtures/seed_playbook_rules.json"),  # Docker
        Path("/app/fixtures/seed_playbook_rules.json"),      # Docker alt
        script_dir.parent / "backend" / "fixtures" / "seed_playbook_rules.json",  # Local
    ]
    
    fixture_path = None
    for path in possible_fixture_paths:
        if path.exists():
            fixture_path = path
            break
    
    if not fixture_path:
        print("[!] Error: seed_playbook_rules.json not found")
        print(f"    Searched: {possible_fixture_paths}")
        return False
    
    print(f"[*] Loading playbook rules from: {fixture_path}")
    
    # Read fixture file
    try:
        with open(fixture_path, 'r') as f:
            rules_data = json.load(f)
    except Exception as e:
        print(f"[!] Error reading fixture file: {e}")
        return False
    
    # Get database session
    db = SessionLocal()
    
    try:
        # Clear existing playbook rules
        print("[*] Clearing existing playbook rules...")
        db.execute(text("DELETE FROM playbook_rules"))
        db.commit()
        
        # Insert rules from fixture
        print(f"[*] Inserting {len(rules_data)} playbook rules...")
        rules = []
        for idx, rule_data in enumerate(rules_data):
            rule = PlaybookRule(
                name=rule_data.get('name', f'Rule {idx+1}'),
                description=rule_data.get('description'),
                condition_json=rule_data.get('condition_json', {}),
                recommendation=rule_data.get('recommendation', ''),
                priority=rule_data.get('priority', 5),
                enabled=1,  # Enabled by default
                created_by_id=2  # Default to Team Lead (user_id 2)
            )
            rules.append(rule)
        
        db.bulk_save_objects(rules)
        db.commit()
        print(f"[+] Inserted {len(rules)} playbook rules")
        
        # Verify count
        rule_count = db.query(PlaybookRule).count()
        print(f"[*] Verification: {rule_count} rules in database")
        
        return True
        
    except Exception as e:
        print(f"[!] Error during seed: {e}")
        db.rollback()
        import traceback
        traceback.print_exc()
        return False
    finally:
        db.close()


if __name__ == "__main__":
    success = seed_playbook_rules()
    sys.exit(0 if success else 1)
