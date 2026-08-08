#!/usr/bin/env python
"""Debug script to test cases endpoint logic."""

import sys
sys.path.insert(0, '.')

from app.database import SessionLocal
from app.models import Case
from app.cases.dedup import calculate_dedup_stats

db = SessionLocal()
try:
    # Try to replicate what the endpoint does
    query = db.query(Case)
    query = query.filter(
        Case.state.in_(['NEW', 'ACCEPTED', 'ESCALATED'])
    )
    query = query.order_by(
        Case.severity.desc(),
        Case.priority.desc(),
        Case.created_at.asc()
    )
    
    total = query.count()
    print(f'✅ Query count: {total}')
    
    cases = query.offset(0).limit(20).all()
    print(f'✅ Cases fetched: {len(cases)}')
    for c in cases[:3]:
        print(f'   - {c.case_id}: {c.state}')
    
    # Try dedup stats
    all_cases_count = db.query(Case).count()
    print(f'✅ All cases: {all_cases_count}')
    
    dedup_stats = calculate_dedup_stats(
        session=db,
        total_anomalies=all_cases_count * 5,
        total_cases=all_cases_count
    )
    print(f'✅ Dedup stats: {dedup_stats}')
    
except Exception as e:
    print(f'❌ Error: {e}')
    import traceback
    traceback.print_exc()
finally:
    db.close()
