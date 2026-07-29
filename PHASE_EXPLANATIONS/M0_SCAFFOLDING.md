# Phase 0 (M0) — Repository Scaffolding: Complete Explanation

**Status:** ✅ COMPLETED  
**Duration:** ~15 hours (Week 1)

---

## Table of Contents

1. [Why This Phase](#why-this-phase)
2. [What We Built](#what-we-built)
3. [How It Works](#how-it-works)
4. [Essential Code & Libraries](#essential-code--libraries)
5. [Key Decisions](#key-decisions)
6. [Interview Q&A](#interview-qa)

---

## Why This Phase

### The Problem
Before building the fraud detection platform, we need:
- A **local development environment** that mirrors production (Docker)
- A **working database** with all tables pre-created
- A **FastAPI application** that can start and serve requests
- A **data pipeline** to load the Kaggle Credit Card Fraud dataset
- **Version control** setup with proper ignore patterns

### Why It Matters
- **No Phase 0 = blocked on Phase 1** — You can't test detection logic without a database and API
- **Docker from day 1** ensures team members (or reviewers) can reproduce locally without "works on my machine" problems
- **Alembic migrations** make schema changes trackable and reversible (PR history = database history)
- **Pre-created schema** means M1-M8 only writes logic, not infrastructure

---

## What We Built

### Directory Structure

```
EarlyBird/
├── docker-compose.yml         # Multi-container orchestration
├── backend/                   # Python/FastAPI application
│   ├── Dockerfile
│   ├── requirements.txt       # Python dependencies
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py           # FastAPI app, CORS, health check
│   │   ├── models.py         # SQLAlchemy ORM models
│   │   ├── database.py       # Connection pooling setup
│   ├── alembic/              # Database migrations
│   │   ├── alembic.ini
│   │   ├── env.py
│   │   ├── script.py.mako
│   │   └── versions/
│   │       └── 001_init_schema.py  # First migration (all tables)
│   ├── tests/
│   │   └── __init__.py
│   └── .env                  # Environment variables
├── frontend/                 # React/Next.js application
│   ├── Dockerfile
│   └── package.json          # Node.js dependencies
├── scripts/
│   └── load_kaggle_dataset.py # Data loading script
├── .gitignore               # Version control ignore patterns
└── PHASE_EXPLANATIONS/      # Documentation (this folder)
    └── M0_SCAFFOLDING.md    # This file
```

### Key Files Created

#### 1. **docker-compose.yml** — Multi-Container Orchestration
```yaml
- postgres:13 service (port 5432)
- backend (FastAPI, port 8000, depends_on postgres)
- frontend (React, port 3000, depends_on backend)
- Shared network: earlybird-network
- Health checks: postgres service waits for healthy db before backend starts
```

**Why:** Developers run `docker compose up` once, get entire stack. No manual database setup.

#### 2. **backend/app/main.py** — FastAPI Entry Point
```python
- FastAPI instance with CORS middleware
- Health check: GET /health → {"status": "ok"}
- Placeholder endpoints for future phases
- Lifespan management for startup/shutdown
```

**Why:** Core application server. Serves all REST API requests in phases 1-6.

#### 3. **backend/app/models.py** — SQLAlchemy ORM Models
Eight tables (models) pre-defined:
- `users` — REVIEWERs and TEAM_LEADs
- `entities` — cards, merchants (M0)
- `transactions` — credit card transactions (M0)
- `anomalies` — detection results (created in M1)
- `root_cause_links` — correlations (created in M2)
- `cases` — grouped anomalies with state machine (created in M3)
- `playbook_rules` — team lead recommendations (created in M4)
- `knowledge_base` — auto-generated KB entries (created in M5)
- `audit_log` — append-only action log (created in M3)

**Why:** 
- All tables declared upfront so M1-M8 just write logic, not schema
- Alembic reads these models to auto-generate migrations
- Relationships and constraints captured in one place

#### 4. **backend/alembic/versions/001_init_schema.py** — Database Migration
```python
upgrade():
  - Creates all 9 tables with columns, constraints, indexes
  - Sets up primary keys, unique constraints, foreign keys
  
downgrade():
  - Drops all tables (for reverting in case of error)
```

**Why:**
- Version control for database schema
- Reproducible across environments (dev, staging, prod)
- Can revert to previous schema if needed
- Every PR = one migration file (trackable history)

#### 5. **backend/app/database.py** — SQLAlchemy Connection Pooling
```python
- Engine: PostgreSQL with QueuePool (5 connections, 10 overflow)
- SessionLocal: Session factory for dependency injection
- get_db(): FastAPI dependency for injecting sessions into endpoints
- test_connection(): Verify database is reachable
```

**Why:**
- Connection pooling prevents exhausting DB connections
- Dependency injection = clean, testable FastAPI code
- `pool_pre_ping=True` ensures stale connections are recycled

#### 6. **backend/requirements.txt** — Python Dependencies
Key libraries:
- `fastapi` (0.104.1) — async web framework
- `uvicorn` — ASGI server for FastAPI
- `sqlalchemy` (2.0.23) — ORM for database access
- `psycopg2-binary` — PostgreSQL adapter
- `alembic` (1.12.1) — database migrations
- `apscheduler` (3.10.4) — background job scheduler (for M1-6)
- `pytest` — testing framework
- `pandas`, `scikit-learn` — data analysis (for M1 detection)

**Why:**
- Pinned versions ensure reproducibility
- Minimal deps (not bloated with "nice-to-haves")
- All critical libraries for fraud detection platform

#### 7. **scripts/load_kaggle_dataset.py** — Data Loading Script
```python
load_dataset(csv_path, sample_size=None):
  1. Read Kaggle CSV (Time, Amount, Class, V1-V28)
  2. Parse rows → Transaction objects
  3. Batch insert into database (commit every 1000 rows)
  4. Print statistics (total, fraudulent %, legitimate %)
  5. Sample 3 transactions to verify
```

**Why:**
- Decouples data loading from Docker container
- Can be run standalone or in initialization script
- Prints summary so developers verify data loaded

---

## How It Works

### Step 1: Start the Stack
```bash
docker compose up
```

**What happens:**
1. Docker builds backend image (Python, dependencies, alembic)
2. Docker builds frontend image (Node, React)
3. Starts postgres:13 container
4. Backend waits for postgres to be healthy (health check: `pg_isready`)
5. Backend runs `alembic upgrade head` (creates all tables)
6. Backend starts FastAPI app on port 8000
7. Frontend starts React on port 3000

### Step 2: Load Data
```bash
python scripts/load_kaggle_dataset.py <path_to_creditcard.csv>
```

**What happens:**
1. Script connects to database (assumes postgres is running)
2. Reads CSV in batches
3. Inserts transactions into `transactions` table
4. Prints: "Inserted 284,807 transactions (fraud: 492 [0.17%], legitimate: 284,315)"

### Step 3: Test Health
```bash
curl http://localhost:8000/health
# Response: {"status": "ok", "service": "EarlyBird API"}
```

**What happens:**
- FastAPI returns 200 with health check JSON
- Frontend at `http://localhost:3000` is also up (though has no routes yet)

---

## Essential Code & Libraries

### 1. **SQLAlchemy Models Pattern**

```python
# backend/app/models.py
from sqlalchemy import Column, Integer, String, Float, DateTime, JSON
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class Transaction(Base):
    __tablename__ = "transactions"
    
    id = Column(Integer, primary_key=True)
    transaction_id = Column(String(50), unique=True, index=True)
    card_id = Column(String(255), index=True)
    amount = Column(Float)
    timestamp = Column(DateTime, index=True)
    label = Column(Integer)  # 0 = legit, 1 = fraud
```

**Key points:**
- `__tablename__` maps to database table name
- `Column(type, constraints)` defines fields
- `index=True` creates database index for fast queries
- `unique=True`, `primary_key=True` enforce constraints

### 2. **Alembic Migration Pattern**

```python
# backend/alembic/versions/001_init_schema.py
def upgrade() -> None:
    op.create_table(
        'transactions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('transaction_id', sa.String(50), nullable=False),
        # ...
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_transactions_card_id', 'transactions', ['card_id'])

def downgrade() -> None:
    op.drop_table('transactions')
```

**Key points:**
- `upgrade()` = apply migration (run migrations forward)
- `downgrade()` = revert migration (useful for rollbacks)
- Every table/index change goes here (database version control)

### 3. **FastAPI Dependency Injection Pattern**

```python
# backend/app/database.py
from fastapi import Depends
from sqlalchemy.orm import Session

def get_db() -> Session:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# backend/app/main.py (future use)
@app.get("/cases")
async def get_cases(db: Session = Depends(get_db)):
    cases = db.query(Case).all()
    return cases
```

**Key points:**
- `Depends(get_db)` injects a database session
- Session automatically closed after request
- Clean separation of concerns (database logic ≠ endpoint logic)

### 4. **Connection Pooling Setup**

```python
# backend/app/database.py
from sqlalchemy.pool import QueuePool

engine = create_engine(
    DATABASE_URL,
    poolclass=QueuePool,
    pool_size=5,         # Keep 5 connections open
    max_overflow=10,     # Allow 10 extra connections if needed
    pool_pre_ping=True,  # Test connections before using (prevent stale)
)
```

**Key points:**
- **QueuePool:** Maintains a queue of open connections
- **pool_size=5:** Backend keeps 5 connections at rest
- **max_overflow=10:** If all 5 busy, create up to 10 more temporarily
- **pool_pre_ping=True:** Before returning connection to app, ping DB to ensure it's still alive
- **Why:** Prevents "connection lost" errors; efficient resource usage

### 5. **Docker Multi-Container Pattern**

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:13-alpine
    environment:
      POSTGRES_USER: earlybird
      POSTGRES_PASSWORD: earlybird_dev
      POSTGRES_DB: earlybird_db
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U earlybird"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - earlybird-network

  backend:
    build:
      context: ./backend
    depends_on:
      postgres:
        condition: service_healthy  # Wait for postgres health check to pass
    environment:
      DATABASE_URL: postgresql://earlybird:earlybird_dev@postgres:5432/earlybird_db
    networks:
      - earlybird-network
```

**Key points:**
- **healthcheck:** postgres waits for DB to be ready before backend starts
- **depends_on:** Express service dependency graph
- **networks:** Services communicate via Docker network (no localhost)
- **environment:** Inject DATABASE_URL so backend knows how to connect

---

## Key Decisions

### 1. **PostgreSQL 13 (not SQLite, not MySQL)**

**Why PostgreSQL:**
- JSONB support (for storing complex evidence, recommendations)
- tsvector full-text search (M5 KB search needs this)
- Append-only audit log enforcement (DO INSTEAD NOTHING rule)
- Production-grade reliability
- No licensing costs

**Rejected:**
- SQLite: single-file db, no network, not suitable for multi-role system
- MySQL: no JSONB or tsvector; more ops overhead

### 2. **SQLAlchemy ORM (not raw SQL)**

**Why SQLAlchemy:**
- Type-safe queries (IDE autocomplete)
- Cross-database portability (though we chose Postgres)
- Relationship management (if we need foreign keys later)
- Alembic integration (migrations)

**Rejected:**
- Raw SQL: error-prone, hard to refactor
- NoSQL: fraud detection needs relational queries (anomaly-to-case joins)

### 3. **Alembic Migrations (not create_all)**

**Why Alembic:**
- Version controlled schema (every change = commit)
- Reversible (downgrade if something breaks)
- Team alignment (can't accidentally run different schema versions)
- Production standard

**Rejected:**
- SQLAlchemy `Base.metadata.create_all()`: one-way, not reversible

### 4. **Docker Compose from Day 1 (not local venv)**

**Why Docker:**
- Reproducible: "works on my machine" isn't an excuse
- Database isolation: multiple developers don't step on each other's data
- Network simulation: matches production networking

**Rejected:**
- Local python venv: hard to coordinate postgres setup
- Manual setup instructions: prone to drift

### 5. **Connection Pooling with pool_pre_ping (not naive connections)**

**Why:**
- Prevents stale connection errors ("psycopg2.OperationalError: server closed connection")
- Efficient resource usage (reuse connections)

---

## Interview Q&A

### Q1: Why do we need Alembic migrations?

**A:** Alembic is database version control. Every schema change (add table, add column, add index) becomes a migration file that can be:
- Version controlled (git history shows DB changes)
- Reviewed in PRs (peer checks DB schema changes)
- Replayed on any environment (dev → staging → prod uses same migrations)
- Reversed (if something breaks, downgrade to previous schema)

Without it, developers would manually run SQL, lose track of changes, and have schema drift between environments.

**Example:** M1 adds anomalies table. That's one migration file. M2 adds root_cause_links. That's a second migration. Each is reviewed, reversible, and traceable.

---

### Q2: Why do we create all 9 tables in the first migration, even though only 3 are used in M0?

**A:** Because:
1. **Schema clarity:** Everyone can see the full domain model upfront (transactions → anomalies → cases → KB)
2. **Foreign key constraints:** Later phases add FK relationships; if we create tables piecemeal, it's easy to have constraint conflicts
3. **Alembic best practice:** Better to have empty tables than to scramble creating tables in M1, M2, etc.
4. **No performance cost:** 9 empty tables take microseconds; no real overhead

The alternative (create tables as-needed in M1, M2, etc.) is messy: M1 migration says "create anomalies", M2 says "create root_cause_links and add FK to anomalies", etc. Harder to understand the model.

---

### Q3: Explain the Docker Compose healthcheck. Why does backend depend_on postgres with condition service_healthy?

**A:** 
- **healthcheck:** Postgres runs `pg_isready -U earlybird` every 10 seconds. If it succeeds, postgres is marked "healthy".
- **depends_on postgres: service_healthy:** Backend doesn't start until postgres is healthy.
- **Why:** If backend starts before postgres is ready, it tries to connect, gets "connection refused", crashes, and restarts in a loop. By waiting for healthy status, we avoid that race condition.

Without this:
```
backend | ERROR: cannot connect to database
backend | Exception in application while serving...
backend | Restarting...
```

With healthcheck:
```
postgres | [HEALTHY] port 5432 accepting connections
backend  | Starting...
backend  | ✓ Database connection successful
```

---

### Q4: Why use connection pooling instead of creating a new connection per request?

**A:** 
- **Per-request:** Create connection → query → close connection (slow, overhead)
- **Pooling:** Create 5 connections upfront, reuse them (fast, low overhead)

**Numbers:** 
- Per-request: ~50ms per connection setup (not negligible for high-frequency API)
- Pooling: ~1ms to grab from queue (fast)

**Pool sizing:**
- `pool_size=5`: Standard FastAPI request concurrency (can handle 5 simultaneous requests)
- `max_overflow=10`: If load spikes, allow temporary connections (up to 15 total)
- `pool_pre_ping=True`: Before reusing a connection, ping the database ("are you still there?"). Prevents stale connection errors.

---

### Q5: Walk me through what happens when I run `docker compose up`.

**A:**

1. **Docker reads docker-compose.yml**
   - Defines three services: postgres, backend, frontend
   - Defines one network: earlybird-network

2. **Build images**
   - Postgres: uses pre-built `postgres:13-alpine`
   - Backend: runs `docker build ./backend` (copies app, installs deps from requirements.txt)
   - Frontend: runs `docker build ./frontend` (installs node deps from package.json)

3. **Start postgres container**
   - Runs healthcheck every 10 seconds: `pg_isready -U earlybird`
   - Postgres is now listening on port 5432 (inside Docker network)
   - Host machine can access at `localhost:5432`

4. **Postgres reports healthy**
   - Healthcheck succeeds (postgres is accepting connections)

5. **Start backend container**
   - `depends_on postgres: service_healthy` is satisfied
   - Backend container starts
   - Runs: `alembic upgrade head` (applies all migrations, creates tables)
   - Starts FastAPI: `uvicorn app.main:app --host 0.0.0.0 --port 8000`
   - Backend is now listening on port 8000

6. **Start frontend container**
   - `depends_on backend` is satisfied (backend is up)
   - Frontend starts React dev server on port 3000

7. **All containers running**
   - `docker compose ps` shows 3 healthy containers
   - Developer can access:
     - Backend API: http://localhost:8000
     - Frontend: http://localhost:3000
     - Database: postgresql://earlybird:earlybird_dev@localhost:5432/earlybird_db

---

### Q6: Explain the FastAPI Depends pattern. How does `get_db()` work?

**A:**

```python
# database.py
def get_db() -> Session:
    db = SessionLocal()  # Create new session
    try:
        yield db  # Give session to endpoint
    finally:
        db.close()  # Always close, even if error

# main.py (future)
@app.get("/cases")
async def get_cases(db: Session = Depends(get_db)):
    # db is a Session object, ready to use
    cases = db.query(Case).all()
    return cases
```

**Flow:**
1. Request arrives: `GET /cases`
2. FastAPI sees `Depends(get_db)` in signature
3. FastAPI calls `get_db()` to get a value for `db`
4. `get_db()` yields a Session
5. Endpoint runs with `db` (a real Session)
6. Endpoint returns response
7. FastAPI resumes `get_db()` after `yield`, runs finally block, closes session

**Why:**
- **Dependency injection:** Session is created/destroyed automatically
- **Clean code:** Endpoints don't worry about session management
- **Testable:** Can inject mock session for testing
- **Resource safety:** Session always closed, even if endpoint crashes

---

### Q7: What happens if the database credentials are wrong?

**A:** The backend container will fail to start:

```
backend | sqlalchemy.exc.OperationalError: (psycopg2.OperationalError) 
         connection failed: could not connect to server: Connection refused
         Is the server running on host "postgres" and accepting TCP/IP connections on port 5432?
```

**Why we need to check:**
- DATABASE_URL is built into the container at runtime (from docker-compose.yml environment)
- If postgres username/password mismatches docker-compose.yml, connection fails
- If DATABASE_URL is malformed, connection fails

**Fix:**
```yaml
# docker-compose.yml
postgres:
  environment:
    POSTGRES_USER: earlybird
    POSTGRES_PASSWORD: earlybird_dev

backend:
  environment:
    DATABASE_URL: postgresql://earlybird:earlybird_dev@postgres:5432/earlybird_db
```
Must match exactly.

---

### Q8: Why do we use `.env` file? What goes in it?

**A:** `.env` stores environment variables that should NOT be committed to git:
```
DATABASE_URL=postgresql://earlybird:earlybird_dev@postgres:5432/earlybird_db
DEBUG=false
SECRET_KEY=...
```

**Why:**
- Keeps secrets out of source code (no hardcoded passwords in git history)
- Different values per environment (dev uses test DB, prod uses real DB)
- Easy to change without editing code

**In Phase 0:** `.env` just has DATABASE_URL and PYTHONUNBUFFERED. Later phases add auth secrets, API keys, etc.

---

### Q9: What does `pool_pre_ping=True` do? Why is it important?

**A:** 
**Without `pool_pre_ping=True`:**
- Backend keeps a connection open to postgres for 8 hours
- Network hiccup or postgres restart happens
- Connection is now stale (broken)
- Backend tries to use stale connection
- Error: `psycopg2.OperationalError: server closed the connection unexpectedly`

**With `pool_pre_ping=True`:**
- Before using a connection from the pool, SQLAlchemy sends a test query: `SELECT 1`
- If it fails, the connection is discarded and replaced with a fresh one
- Backend never encounters stale connections

---

### Q10: Describe the three microservices in docker-compose.yml and why they're separate.

**A:**

1. **PostgreSQL (postgres service)**
   - Stores all data (transactions, anomalies, cases, etc.)
   - Runs on port 5432 (inside Docker network)
   - Persists to docker volume `postgres_data` (survives container restart)
   - Separate from app = can restart backend without losing data

2. **FastAPI Backend (backend service)**
   - Python/FastAPI application logic
   - Runs on port 8000
   - Depends on postgres for data
   - Separate from frontend = backend can be restarted independently
   - Can scale backend replicas without replicating frontend

3. **React Frontend (frontend service)**
   - User interface (React/Next.js)
   - Runs on port 3000
   - Depends on backend API
   - Separate so frontend dev doesn't interrupt backend dev

**Why separate (not monolithic single container):**
- **Scalability:** Can run 2 backend containers, 1 postgres (can't do that in single container)
- **Technology isolation:** Backend is Python; frontend is Node; can update independently
- **Development velocity:** Frontend dev can work without restarting backend

This is still a "modular monolith" (not microservices) because:
- One postgres instance (not sharded)
- One backend instance (not load-balanced)

---

## Phase 6 Production Container Hardening & Multi-Stage Deployment

**Status:** ✅ COMPLETE  
**Completion Date:** July 2026  

### Key Enhancements & Security Standards
1. **Backend Multi-Stage Build (`backend/Dockerfile`)**:
   - Stage 1 (`builder`): Compiles dependencies into isolated `/opt/venv` using `python:3.11-slim`.
   - Stage 2 (`runtime`): Minimal runtime container with non-root security context (`appuser:10001` / `appgroup`).
   - Container HEALTHCHECK polling `http://localhost:8000/api/v1/health`.
2. **Frontend Multi-Stage Build & Nginx (`frontend/Dockerfile` & `nginx.conf`)**:
   - Stage 1 (`builder`): `node:20-alpine` runs clean `npm ci` and production compilation `npm run build`.
   - Stage 2 (`runtime`): `nginx:alpine` serving compiled static assets.
   - SPA Fallback (`try_files $uri $uri/ /index.html`) & reverse proxying `/api/` to `http://backend:8000`.
3. **Orchestration (`docker-compose.yml`)**:
   - `postgres:15-alpine` database with healthchecks.
   - Automated health dependencies (`depends_on` -> `service_healthy`) and persistent volumes (`postgres_data`).
- No inter-service auth/discovery complexity

---

### Q11: How can EarlyBird be run locally without Docker for rapid dev/testing?

**A:** 
Via `setup_local_database.py`:
```bash
python setup_local_database.py
```
This script connects to local PostgreSQL (or SQLite/configured `DATABASE_URL`), drops & rebuilds tables cleanly, seeds initial users (`Reviewer Alex`, `Team Lead Sarah`), loads 10,000 Kaggle dataset transactions, and populates initial playbook rule fixtures. It allows rapid local execution and test suite runs without container overhead.

---

### Q12: Why freeze the API contract baseline (/api/v1) in Phase 0?

**A:** 
Freezing the contract matrix before implementing frontend pages prevents "moving target" frontend bug loops. It establishes:
1. Canonical `/api/v1` route prefix across backend and frontend.
2. Standard bearer auth token handling (`Authorization: Bearer <user_id>`).
3. Uniform health check endpoint `/api/v1/health`.

---

## Summary for Interview

**What is Phase 0?**
Foundation scaffolding: Docker Compose setup, direct local database setup (`setup_local_database.py`), database schema reconciliation, FastAPI skeleton, and canonical `/api/v1` contract baseline freezing.

**Why is it important?**
Unblocks all future phases. M1 focuses on detection, not infrastructure setup.

**Key technologies:**
- Docker Compose & Local Setup Script (`setup_local_database.py`)
- PostgreSQL + Alembic: version-controlled schema
- SQLAlchemy: type-safe ORM
- FastAPI: async web framework with `/api/v1` routing
- Connection pooling: efficient database access

**Proof it works:**
```bash
python setup_local_database.py
curl http://localhost:8000/api/v1/health
# → {"status": "ok", "service": "EarlyBird API", "apiVersion": "v1"}
```

---

**Next Phase:** M1 — Detection Engine (rolling baseline + anomaly scoring)
