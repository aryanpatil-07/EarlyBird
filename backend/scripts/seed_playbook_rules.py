"""
Seed playbook rules from fixtures/seed_playbook_rules.json into database.

Usage:
    python -m scripts.seed_playbook_rules
"""

import json
import os
import sys
from datetime import datetime

# Add parent directory to path to import app modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models import PlaybookRule, User


def load_default_user(session):
    """Ensure default TEAM_LEAD user exists."""
    existing_user = session.query(User).filter(User.user_id == "system").first()
    if existing_user:
        return existing_user.id
    
    system_user = User(user_id="system", role="TEAM_LEAD")
    session.add(system_user)
    session.commit()
    return system_user.id


def seed_playbook_rules():
    """Load playbook rules from JSON fixture into database."""
    session = SessionLocal()
    
    try:
        # Get fixture path
        fixture_path = os.path.join(
            os.path.dirname(__file__),
            "..",
            "fixtures",
            "seed_playbook_rules.json"
        )
        
        if not os.path.exists(fixture_path):
            print(f"❌ Fixture file not found: {fixture_path}")
            return False
        
        # Load JSON
        with open(fixture_path, "r") as f:
            rules_data = json.load(f)
        
        # Ensure system user exists
        system_user_id = load_default_user(session)
        
        # Clear existing rules to avoid duplicates
        session.query(PlaybookRule).delete()
        session.commit()
        
        # Insert rules
        for rule_data in rules_data:
            rule = PlaybookRule(
                name=rule_data["name"],
                description=rule_data.get("description"),
                condition_json=rule_data["condition_json"],
                recommendation=rule_data["recommendation"],
                priority=rule_data.get("priority", 5),
                enabled=1,
                created_by_id=system_user_id,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            session.add(rule)
        
        session.commit()
        
        print(f"✅ Successfully seeded {len(rules_data)} playbook rules")
        return True
    
    except Exception as e:
        session.rollback()
        print(f"❌ Error seeding playbook rules: {e}")
        return False
    
    finally:
        session.close()


if __name__ == "__main__":
    success = seed_playbook_rules()
    sys.exit(0 if success else 1)
