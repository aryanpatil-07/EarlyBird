# EarlyBird — High-Level Design (HLD) Document

**System Name:** EarlyBird Transaction Fraud Anomaly Detection & Knowledge Platform  
**Document Version:** 1.0.0  
**Architectural Style:** Modular Monolith with Decoupled Internal Subsystems  
**Target Environment:** Dockerized Linux / Local Dev / Multi-Container Compose  

---

## 1. Architectural Philosophy & System Overview

EarlyBird is structured as a **Modular Monolith** rather than a distributed set of microservices. This design choice provides:
* **Single Deployment Unit**: Zero network latency or serialized RPC overhead between detection, correlation, and triage layers.
* **ACID Transaction Guarantees**: Anomaly detection, audit logging, and Knowledge Base writes occur within unified transactional boundaries.
* **Explicit Internal Seams**: Subsystems interact via well-defined domain services, enabling future microservice extraction if independent team scaling is required.

```mermaid
flowchart TB
    subgraph ClientTier ["Presentation Tier (Web Client)"]
        UI["React 18 + TypeScript SPA<br/>(Tailwind CSS + Anime.js + Lucide)"]
    end

    subgraph APITier ["Application Server Tier (FastAPI Monolith)"]
        Router["FastAPI REST Router (/api/v1)"]
        
        subgraph CoreEngines ["Core Domain Subsystems"]
            Ingest["Ingestion & ETL Service"]
            Detect["Statistical Detection Engine<br/>(EWMA + Z-Score Deviation)"]
            RCA["Root Cause Correlation Engine<br/>(Multi-Entity / Time-Window Graph)"]
            Triage["Case State Machine & Triage Engine<br/>(Optimistic Concurrency Control)"]
            Playbook["Playbook Rule Matching Engine"]
            KBGen["Knowledge Base Generator<br/>(Auto-Markdown & NLP Search)"]
            Audit["Immutable Audit Logger"]
        end

        Sched["APScheduler Background Daemon<br/>(Detection & Correlation Cycles)"]
    end

    subgraph DataTier ["Data Tier (PostgreSQL 16)"]
        PG[("PostgreSQL Database<br/>(QueuePool + JSONB Indexes)")]
    end

    UI -->|REST API Requests / Bearer Tokens| Router
    Router --> Ingest & Detect & RCA & Triage & Playbook & KBGen & Audit
    Sched -->|Triggers Cycles| Detect & RCA & Triage
    Ingest & Detect & RCA & Triage & Playbook & KBGen & Audit <-->|SQLAlchemy ORM + Connection Pooling| PG
```

---

## 2. End-to-End Pipeline & Data Flow Architecture

The data pipeline progresses from raw transaction ingestion to detection, correlation, triage, and institutional documentation:

```mermaid
flowchart LR
    A[Raw Transactions<br/>Batch / Stream] --> B(Ingestion & Normalization)
    B --> C[(PostgreSQL<br/>transactions)]
    
    C --> D{Detection Engine<br/>Rolling Baseline}
    D -->|Z-Score >= 2.0σ| E[Anomalies Table]
    D -->|Z-Score < 2.0σ| F[Normal Transaction]
    
    E --> G{Root Cause Engine<br/>Temporal Graph}
    G --> H[Root Cause Links<br/>Evidence Graph]
    
    H --> I{Deduplication &<br/>Case Aggregator}
    I -->|Active Case Exists| J[Increment Duplicate Count]
    I -->|New Pattern| K[Create New Case]
    
    K --> L[Playbook Rules Matcher]
    L --> M[Recommended Action Displayed]
    
    M --> N{Analyst Triage Decision}
    N -->|Accept / Reject / Modify| O[Case RESOLVED]
    N -->|Complex Dispute| P[Case ESCALATED]
    N -->|SLA Timer Expires| P
    
    O --> Q[KB Auto-Generator]
    Q --> R[(Knowledge Base<br/>Indexed Precedent)]
```

---

## 3. Subsystem Breakdown & Responsibilities

### 3.1 Ingestion & Normalization Subsystem
* **Purpose**: Ingests raw card transaction records, maps entities (card IDs, merchant IDs, terminal IDs), and stores timestamps in UTC.
* **Key Components**: `app.models.Transaction`, `app.models.Entity`.

### 3.2 Detection Engine (Rolling Statistical Baselines)
* **Purpose**: Evaluates incoming transactions against rolling historical spending profiles per cardholder entity.
* **Algorithm**: Computes Exponentially Weighted Moving Average (EWMA) and Standard Deviation over rolling transaction windows. Calculates standard Z-score:
  $$Z = \frac{x - \mu_{\text{baseline}}}{\sigma_{\text{baseline}}}$$
* **Thresholding**: Automatically generates an `Anomaly` record whenever $Z \ge 2.0$.

### 3.3 Root Cause Correlation Subsystem
* **Purpose**: Resolves the "black-box alert" problem by linking flagged anomalies with contextual background transactions.
* **Heuristics**:
  * **Same Entity Velocity**: Rapid successive transactions on the same card within $< 15\text{ minutes}$.
  * **Merchant Terminal Point of Compromise**: Multiple distinct cards experiencing unauthorized charges after transacting at the same merchant.
  * **Geographic Impossibility**: Transactions occurring at physical locations separated by unrealistic travel times.
* **Output**: Writes to `root_cause_links` with evidence JSON payloads.

### 3.4 Case Management & Triage Subsystem
* **Purpose**: Deduplicates anomalies into manageable operational units (Cases) and governs their lifecycle through a strict Finite State Machine.
* **States**: `NEW`, `ACCEPTED` (In Progress), `ESCALATED`, `RESOLVED`.
* **Concurrency**: Implements Optimistic Concurrency Control using a database `version` column to prevent overwrites when multiple reviewers triage cases concurrently.

### 3.5 Playbook Rules Subsystem
* **Purpose**: Allows Team Leads to author deterministic if-this-then-that operational policies.
* **Matching**: Evaluates conditions (e.g. `amount_min`, `z_score_min`, `category`, `mcc`) and attaches automated recommendation text to cases before human review.

### 3.6 Auto-Documenting Knowledge Base Subsystem
* **Purpose**: Automatically generates permanent, searchable forensic documentation upon case resolution.
* **Indexing**: Stores rich Markdown summaries with categorized metadata (`CNP e-Commerce`, `Velocity Burst`, `Account Takeover`, `Compromised Terminal`, `Geographic Impossibility`, `Authorized Travel`).
* **Search**: Full-text neural/keyword search across precedent titles, card IDs, and evidence summaries.

### 3.7 Audit & Compliance Subsystem
* **Purpose**: Append-only tamper-evident event stream capturing every state transition, rationale, reviewer action, and SLA event.

---

## 4. Technology Stack & Component Mapping

| Subsystem / Layer | Technology Selected | Technical Rationale |
|---|---|---|
| **Frontend Framework** | React 18 + TypeScript | Component modularity, strong static typing, responsive UI state management. |
| **Styling & Design System** | Tailwind CSS + Custom CSS Variables | OLED dark-mode palette (`#08090C`, `#111218`), electric sky glow accents, accessible contrast. |
| **Backend API Framework** | Python 3.11 + FastAPI | Native asynchronous endpoints, automatic OpenAPI/Swagger generation, Pydantic type safety. |
| **ORM & Database Driver** | SQLAlchemy 2.0 + Psycopg2 | Type-annotated ORM models, transaction management, connection pool recycling (`QueuePool`). |
| **Database Engine** | PostgreSQL 16 | ACID compliance, JSONB document indexing, robust full-text search vector support. |
| **Job Scheduling Daemon** | APScheduler (BackgroundScheduler) | In-process daemon executing periodic detection and correlation cycles without external Redis overhead. |

---

## 5. Deployment & Container Infrastructure Architecture

```mermaid
flowchart TD
    subgraph Host ["Physical / Cloud Host Environment"]
        subgraph Compose ["Docker Compose Network (earlybird-network)"]
            
            subgraph FEContainer ["Frontend Container (earlybird-frontend)"]
                Nginx["Nginx / Node Web Server<br/>Port 3000 (Internal: 80/3000)"]
                Build["Production React Build<br/>Static SPA Bundle"]
            end
            
            subgraph BEContainer ["Backend Container (earlybird-backend)"]
                Uvicorn["Uvicorn ASGI Server<br/>Port 8000"]
                FastAPIApp["FastAPI Application"]
                Scheduler["APScheduler Background Worker"]
            end
            
            subgraph DBContainer ["Database Container (earlybird-db)"]
                Postgres["PostgreSQL 16 Server<br/>Port 5432"]
                PGData[("Named Volume<br/>postgres_data")]
            end
        end
    end

    User[Fraud Reviewer / Browser] -->|HTTP / Port 3000| Nginx
    Nginx -->|Proxy /api/v1| Uvicorn
    Uvicorn --> FastAPIApp
    FastAPIApp <-->|TCP / Port 5432| Postgres
    Postgres <--> PGData
```

### Container Specifications:
* **`earlybird-frontend`**: Serves compiled React assets, handles SPA fallback routing, and proxies API traffic.
* **`earlybird-backend`**: Runs FastAPI under Uvicorn with auto-lifespan initialization (seeding default users and starting APScheduler jobs).
* **`earlybird-db`**: PostgreSQL 16 with persistent volume storage and `pg_isready` health check definitions.

---

## 6. Security, RBAC & Authentication Design

```mermaid
graph LR
    subgraph AuthFlow ["Authentication & Token Verification"]
        LoginReq["POST /api/v1/auth/login<br/>{ userId: '1' }"] --> TokenGen["Generate Cryptographic<br/>Bearer Token"]
        TokenGen --> TokenResponse["IdentityResponse<br/>{ accessToken, role, name }"]
        
        ClientReq["API Request +<br/>Authorization: Bearer &lt;token&gt;"] --> AuthGuard{"Role Guard"}
        AuthGuard -->|Role == REVIEWER| ReviewerPerms["Queue, Detail, Accept/Reject/Escalate"]
        AuthGuard -->|Role == TEAM_LEAD| LeadPerms["All Reviewer Perms + Resolve Escalated + Author Rules"]
        AuthGuard -->|Invalid / Missing| Error401["HTTP 401 Unauthorized / HTTP 403 Forbidden"]
    end
```

* **Token Scheme**: Bearer tokens containing encoded role identifiers (`REVIEWER`, `TEAM_LEAD`).
* **Route Protection**: FastAPI dependency injection (`Depends(get_current_user)`) verifies user identity and role authorizations on every write operation.
