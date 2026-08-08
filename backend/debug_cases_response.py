#!/usr/bin/env python
"""Debug script to test case response serialization."""

import sys
sys.path.insert(0, '.')

from app.database import SessionLocal
from app.models import Case
from app.routers.cases import CaseDetailResponse

db = SessionLocal()
try:
    # Get a case
    case = db.query(Case).first()
    print(f'✅ Case: {case}')
    print(f'   - id: {case.id}')
    print(f'   - case_id: {case.case_id}')
    print(f'   - state: {case.state}')
    print(f'   - severity: {case.severity}')
    print(f'   - priority: {case.priority}')
    print(f'   - version: {case.version}')
    print(f'   - created_at: {case.created_at}')
    print(f'   - updated_at: {case.updated_at}')
    
    # Try to convert to response
    response = CaseDetailResponse.from_orm(case)
    print(f'✅ Response: {response}')
    
except Exception as e:
    print(f'❌ Error: {e}')
    import traceback
    traceback.print_exc()
finally:
    db.close()
