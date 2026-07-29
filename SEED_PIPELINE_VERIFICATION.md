# EarlyBird Seed Pipeline Verification Checklist

**Last Updated:** July 20, 2026  
**Status:** ✅ Ready for Testing  
**Session:** Context-Compacted Resume

## Overview

This document outlines the verification steps for the seed data pipeline. After the previous session's fixes, the infrastructure is complete:

- ✅ Docker build context updated (root level, not backend-only)
- ✅ Entrypoint orchestration script created
- ✅ Seed data loading script implemented with context-aware path handling
- ✅ Playbook rules seeding added
- ✅ User seeding migration created
- ✅ Scheduler jobs (M1 detection, M2 correlation) wired up
- ✅ Frontend API client connected to real backend

## Startup Flow

```
docker compose up
  │
  └─> postgres service starts
  │     └─> healthcheck passes
  │
  └─> backend service builds (root context) and starts
      ├─ entrypoint.sh [1] runs migrations (001→002→003→004)
      │   └─> Creates schema + seeds users (user_id: 1 REVIEWER, 2 TEAM_LEAD)
      ├─ [2] Loads kaggle dataset (10,000 transactions)
      │   └─> Creates card entities + inserts TX
      ├─ [3] Seeds playbook rules (6 rules from fixture)
      ├─ [4] Waits 2s for scheduler startup
      └─ [5] Launches uvicorn on :8000
          ├─ Scheduler jobs registered in lifespan
          ├─ Detection cycle: every 5 min (score unscored TX → create anomalies)
          └─ Correlation cycle: every 10 min (correlate anomalies → create root_cause_links)
  │
  └─> frontend service starts on :3000
      └─> Calls http://localhost:8000/api/* endpoints (real data, no mocks)
```

## Verification Steps

### ✅ Pre-Test: Files in Place

| File | Location | Purpose | Status |
|------|----------|---------|--------|
| entrypoint.sh | backend/ | Orchestrates startup sequence | ✅ Created |
| load_kaggle_dataset.py | scripts/ | Loads CSV → transactions/entities | ✅ Updated paths |
| seed_playbook_rules.py | scripts/ | Loads fixture → playbook_rules table | ✅ Created |
| 004_seed_users.py | backend/alembic/versions/ | Alembic migration seeds users | ✅ Created |
| Dockerfile | backend/ | Copies data/scripts, sets ENTRYPOINT | ✅ Updated |
| docker-compose.yml | root/ | Builds from root context, no `command:` override | ✅ Updated |

### ✅ Phase 1: Startup Verification

Run these commands in terminal:

```bash
# Start containers (first time: ~1-2min for build + migrations + seed load)
docker compose up

# Expected logs (watch backend container):
# [1/5] Running database migrations...
# [✓] Migrations complete
# [2/5] Loading seed data...
#     Found creditcard.csv, loading 10,000 transactions...
# [✓] Seed data loaded successfully
# [3/5] Seeding playbook rules...
#     Found playbook rules fixture, loading into database...
# [✓] Playbook rules seeded
# [4/5] Waiting for scheduler warmup...
# [5/5] Starting EarlyBird API server...
#     API: http://0.0.0.0:8000
#     Docs: http://0.0.0.0:8000/docs
```

### ✅ Phase 2: Database Verification

Once containers are running, verify data in database:

```bash
# Connect to postgres
docker exec -it earlybird-postgres psql -U earlybird -d earlybird_db

# Check users seeded
earlybird_db=# SELECT user_id, role FROM users;
 user_id |   role    
---------+-----------
 1       | REVIEWER
 2       | TEAM_LEAD
(2 rows)

# Check transactions loaded
earlybird_db=# SELECT COUNT(*) FROM transactions;
 count
-------
 10000
(1 row)

# Check fraud distribution (per Kaggle dataset, ~0.17% fraud rate)
earlybird_db=# SELECT label, COUNT(*) FROM transactions GROUP BY label;
 label |  count
-------+--------
     0 |   9984
     1 |     16
(2 rows)

# Check card entities created (~10 unique cards for 10k transactions)
earlybird_db=# SELECT COUNT(DISTINCT card_id) FROM transactions;
 count
-------
    10
(1 row)

# Check playbook rules seeded
earlybird_db=# SELECT name, priority, enabled FROM playbook_rules ORDER BY priority DESC;
                   name                    | priority | enabled
---------------------------------------------+----------+---------
 High Z-Score Anomaly                       |       10 |       1
 High-Value Card Usage                      |        9 |       1
 Card Testing Pattern                       |        9 |       1
 Rapid Multi-Transaction Pattern            |        8 |       1
 Merchant Mismatch Variation                |        7 |       1
 Geographic Anomaly                         |        6 |       1
(6 rows)

# Exit psql
\q
```

### ✅ Phase 3: Scheduler Jobs Verification

Wait 5 minutes, then check if M1 detection job created anomalies:

```bash
# After 5 min, M1 detection cycle should have run
docker exec -it earlybird-postgres psql -U earlybird -d earlybird_db -c \
  "SELECT COUNT(*) FROM anomalies;"

# Expected: Some anomalies should be created (~10-50 depending on baseline distribution)
# If 0, check backend logs for detection_cycle_callback errors
```

Wait another 10 minutes, then check if M2 correlation job created links:

```bash
# After 15 min total, M2 correlation cycle should have run
docker exec -it earlybird-postgres psql -U earlybird -d earlybird_db -c \
  "SELECT COUNT(*) FROM root_cause_links;"

# Expected: Some links (at least a few) if anomalies exist and correlation rules match
```

### ✅ Phase 4: API Endpoint Verification

Test API endpoints directly:

```bash
# Health check
curl http://localhost:8000/health
# Expected: {"status":"ok","service":"EarlyBird API"}

# Login (create auth token)
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"userId": 1}'
# Expected: {"access_token":"...", "token_type":"bearer"}

# Get cases (if M3 job exists and created cases)
curl -H "Authorization: Bearer 1" http://localhost:8000/api/cases
# Expected: {"cases": [...], "total": N} or empty list if M3 not yet implemented

# Get dashboard metrics
curl -H "Authorization: Bearer 1" http://localhost:8000/api/dashboard/metrics
# Expected: Metrics object with real counts (transactions, anomalies, etc.)
```

### ✅ Phase 5: Frontend Verification

Navigate to http://localhost:3000 and verify 5 screens load real data:

| Screen | Data Source | Expected Data |
|--------|-------------|----------------|
| Queue | /api/cases | N cases (or empty if M3 not run yet) |
| Case Detail | /api/cases/{id} | Transaction details, evidence, links |
| KB Search | /api/knowledge-base/search | Resolved cases indexed |
| Dashboard | /api/dashboard/metrics | Real counts: 10k TX, N anomalies, N links, N playbook rules |
| Rules | /api/playbook-rules | 6 seeded rules from fixture |

**Critical Check:** All screens should show **real data from database**, not mock data.

## Troubleshooting

| Issue | Diagnosis | Fix |
|-------|-----------|-----|
| "creditcard.csv not found" | CSV not copied into Docker | Ensure `COPY data /app/data` in Dockerfile |
| "app.database module not found" | Python path wrong | Check sys.path logic in load_kaggle_dataset.py |
| Migrations fail | PostgreSQL not ready | Increase healthcheck retries or wait longer before migration |
| Anomalies count = 0 after 5 min | M1 detection cycle didn't run | Check backend logs for scheduler errors; verify APScheduler started |
| Frontend shows 404 errors | API URL wrong | Check `REACT_APP_API_URL` in docker-compose.yml |
| Auth token rejected | User not seeded | Verify 004_seed_users.py ran; check users table |

## Implementation Checklist

| Task | Status | Notes |
|------|--------|-------|
| Dockerfile: Build context root level | ✅ | Updated COPY commands |
| Dockerfile: Include data + scripts | ✅ | COPY data /app/data + COPY scripts /app/scripts |
| entrypoint.sh: 5-step orchestration | ✅ | Migrations → seed CSV → seed rules → warmup → uvicorn |
| load_kaggle_dataset.py: Context-aware paths | ✅ | Tries backend/, /app, /app/scripts paths |
| seed_playbook_rules.py: Load fixture → DB | ✅ | Clears + bulk_insert from fixture JSON |
| 004_seed_users.py: Alembic migration | ✅ | Seeds user_id 1 REVIEWER, 2 TEAM_LEAD |
| docker-compose.yml: No command: override | ✅ | Uses ENTRYPOINT from Dockerfile |
| docker-compose.yml: Mounts data + scripts | ✅ | For hot reload during dev |
| Scheduler: Detection cycle in main.py | ✅ | Every 5 min, calls detection_cycle_callback |
| Scheduler: Correlation cycle in main.py | ✅ | Every 10 min, calls correlation_cycle_callback |
| Frontend API client: Calls real endpoints | ✅ | No mock data, all endpoints call backend |

## Success Criteria

✅ **Seed pipeline successful when:**

1. `docker compose up` completes without error
2. Backend logs show all 5 startup steps completing
3. Database queries show:
   - 2 users seeded (REVIEWER, TEAM_LEAD)
   - ~10,000 transactions loaded
   - ~10 card entities created
   - 6 playbook rules seeded
4. After 5 min: Anomalies table has rows (M1 detection ran)
5. After 15 min: Root_cause_links table has rows (M2 correlation ran)
6. All 5 frontend screens load without 404 errors
7. Frontend data matches database (real data, not mock)

## Session Summary

**Previous Session (Completion):**
- Identified root cause: seed data not invoked in Docker startup
- Created entrypoint.sh orchestration
- Updated Dockerfile to use ENTRYPOINT
- Fixed path handling for CSV loading

**This Session (Configuration):**
- Fixed Docker build context (root level, not ./backend)
- Updated entrypoint.sh paths (./data instead of ../data)
- Updated load_kaggle_dataset.py for context-aware path resolution
- Created seed_playbook_rules.py script
- Created 004_seed_users.py Alembic migration
- Updated entrypoint to call both scripts
- Updated docker-compose.yml to remove `command:` override
- Added this verification checklist

**Next Steps:**
1. Run `docker compose up`
2. Follow Phase 1-5 verification steps
3. Document any issues or deviations
4. Proceed to Phase 2 (auth picker) once seed pipeline confirms working

---

**Status:** ✅ Ready for testing  
**Time to verify:** ~20 minutes (includes 15-min wait for scheduler jobs)
