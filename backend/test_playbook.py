#!/usr/bin/env python
"""Debug playbook endpoint."""

import sys
sys.path.insert(0, '.')

from app.database import SessionLocal
from app.models import PlaybookRule

db = SessionLocal()
try:
    rules = db.query(PlaybookRule).filter(PlaybookRule.enabled == 1).all()
    print(f'✅ Found {len(rules)} enabled rules')
    for r in rules[:3]:
        print(f'   - {r.name} (priority={r.priority})')
except Exception as e:
    print(f'❌ Error: {e}')
    import traceback
    traceback.print_exc()
finally:
    db.close()
