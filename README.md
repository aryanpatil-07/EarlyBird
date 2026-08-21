# EarlyBird — Transaction Fraud Anomaly Detection, Root Cause & Knowledge Platform

**Deployment Links:**
* **Frontend Application**: [https://early-bird-pi.vercel.app](https://early-bird-pi.vercel.app)
* **Backend API**: [https://earlybird-werz.onrender.com](https://earlybird-werz.onrender.com)

> **EarlyBird** is a real-time transaction fraud anomaly detection platform focused on explainable **Root Cause Analysis (RCA)**, **Auto-Generated Knowledge Base Precedents**, **Auditability**, and **Intelligent Alert Triage**. Built with **Python / FastAPI**, **PostgreSQL**, and **React / TypeScript**.

---

## 1. Executive Summary

Credit card fraud detection systems in enterprise production often suffer from high noise-to-signal ratios, fragmented context, and institutional memory loss. When alerts fire in isolation, fraud analysts waste valuable time manually gathering context across logs, making judgment calls that are rarely captured systematically.

**EarlyBird** addresses this by providing a unified, human-in-the-loop triage system that:
1. **Detects Anomalies**: Employs statistical baseline deviation engines ($z$-score and rolling baselines) to identify suspicious transaction activity.
2. **Correlates Root Causes**: Automatically aggregates related entity events (velocity spikes, high-value bursts, merchant category shifts) to explain *why* an anomaly was flagged.
3. **Triage & Escalation**: Manages cases across a two-tier review hierarchy (**REVIEWER** analysts and **TEAM_LEAD** supervisors) with strict SLA tracking and optimistic concurrency controls.
4. **Auto-Generates Documentation**: Converts every resolved incident into an indexed, searchable **Knowledge Base Precedent**, transforming individual case resolutions into an evolving institutional memory.

---

## 2. The Fraud Detection Problem

Credit card fraud operations face significant structural challenges:

* **High False-Positive Noise**: Traditional static rules produce 70–90% false-positive rates, leading to severe alert fatigue.
* **Context Loss During Escalation**: When a reviewer escalates an ambiguous case to a supervisor, research context is lost, forcing duplicate investigation effort.
* **No Institutional Feedback Loop**: Resolved cases are rarely archived as structured post-mortems, causing organizations to repeat analysis on recurring fraud patterns.
* **Lack of Auditability**: State transitions and reviewer rationales are stored across email threads or unstructured tickets rather than an append-only audit trail.

---

## 3. The Four Core Focus Areas

EarlyBird is structured around four architectural pillars:

| Focus Area | Objective | Implementation |
| :--- | :--- | :--- |
| **Root Cause Analysis `[RCA]`** | Provide instant, explainable context alongside flagged anomalies. | Statistical baseline ($z$-score) deviation + correlated entity activity lookup. |
| **Documentation `[DOC]`** | Turn case resolutions into reusable organizational memory. | Auto-generated Knowledge Base precedent entries written in the same DB transaction as case resolution; full-text search via PostgreSQL `tsvector`. |
| **Communication & Audit `[COMM]`** | Ensure 100% loss-less escalation and strict audit compliance. | Immutable, append-only `audit_log` recording every state transition, actor, timestamp, and rationale. |
| **Alert Triage & Deduplication `[ALERT]`** | Reduce alert fatigue and enforce SLA timelines. | Time-windowed alert de-duplication merging near-duplicate signals; SLA breach auto-escalation background jobs. |

---

## 4. System Architecture & Data Flow

EarlyBird is built as a **modular monolith** — prioritizing clean internal module boundaries, high performance, and ease of operation without microservice overhead.

### High-Level Component Architecture

```mermaid
flowchart TD
    A["Transaction Data Stream<br/>(Credit Card Transactions)"] --> B[Ingestion & Ingestion Pipeline]
    B --> DB[(PostgreSQL Database)]
    B --> C[Detection Engine<br/>rolling baseline + deviation]
    C --> D[Root Cause Engine<br/>correlated event lookup]
    D --> E[Case & Alert Module<br/>severity, de-dup, SLA tracking]
    E --> F[Knowledge Base Module<br/>auto-generated precedents]
    E --> G[Audit & Logging Module<br/>append-only audit trail]
    E --> H[Web Dashboard & Workspace<br/>React / TypeScript]
    F --> H
    G --> H
    DB --> C
    DB --> D
    DB --> E
    DB --> F
    DB --> G
```

### Alert Lifecycle & Pipeline Flow

```mermaid
flowchart TD
    T[Transaction Ingested] --> D{Deviation from<br/>Entity Baseline?}
    D -->|No| N[Baseline Normal]
    D -->|Yes| R[Root Cause Engine:<br/>correlate related activity]
    R --> S[Assign Severity Rating]
    S --> Dup{Near-duplicate of<br/>open alert in window?}
    Dup -->|Yes| Merge[Merge into Existing Case]
    Dup -->|No| New[Create New Case]
    New --> Q[Reviewer Alert Queue]
    Merge --> Q
    Q --> Ack{Acknowledged within<br/>SLA window?}
    Ack -->|No| Esc[Auto-Escalate to Team Lead<br/>+ record SLA breach]
    Ack -->|Yes| Act[Reviewer: Accept / Reject / Escalate]
    Esc --> Act
    Act --> KB[Auto-Write Knowledge Base Precedent]
    KB --> Close[Case Resolved & Archived]
```

### Entity-Relationship Diagram (ERD)

```mermaid
erDiagram
    USERS ||--o{ CASES : "assigned to / reviews"
    USERS ||--o{ AUDIT_LOG : "performs action"
    USERS ||--o{ PLAYBOOK_RULES : "authors"
    ENTITIES ||--o{ TRANSACTIONS : "owns"
    ENTITIES ||--o{ ANOMALIES : "flagged on"
    TRANSACTIONS ||--o{ ANOMALIES : "triggers"
    ANOMALIES ||--o{ ROOT_CAUSE_LINKS : "explained by"
    ANOMALIES ||--|| CASES : "wrapped by"
    CASES ||--o{ RECOMMENDATIONS : "generates"
    PLAYBOOK_RULES ||--o{ RECOMMENDATIONS : "sources"
    CASES ||--o{ AUDIT_LOG : "audited in"
    CASES ||--|| KNOWLEDGE_BASE : "documented as precedent"
```

---

## 5. User Workflows & Triage Sequence

### Happy Path: Reviewer Triage & Case Acceptance

```mermaid
sequenceDiagram
    actor R as REVIEWER
    participant Q as Alert Queue
    participant CD as Case Detail View
    participant API as FastAPI Backend
    participant DB as PostgreSQL
    
    R->>Q: Click case from queue
    Q->>CD: Open Case Detail View
    CD->>API: GET /api/v1/cases/{id}
    API->>DB: Fetch case + evidence + root cause + playbooks
    API-->>CD: Return case payload
    CD->>R: Render Evidence, Correlated Signals & Recommendations
    R->>CD: Review context & click ACCEPT (Confirmed Fraud)
    CD->>API: POST /api/v1/cases/{id}/decision {decision: ACCEPT}
    API->>DB: Update state to RESOLVED, write Audit Log, auto-create Knowledge Base entry
    API-->>CD: 200 OK
    CD-->>R: Toast "Case resolved & precedent recorded"
    CD->>Q: Redirect to Alert Queue
```

### Escalation Path: Reviewer to Team Lead Resolution

```mermaid
sequenceDiagram
    actor R as REVIEWER
    participant CD as Case Detail View
    actor T as TEAM_LEAD
    participant Q as Queue
    participant API as FastAPI Backend
    participant DB as PostgreSQL
    
    R->>CD: Click ESCALATE button
    CD->>R: Prompt for Escalation Rationale
    R->>CD: Enter rationale & submit
    CD->>API: POST /api/v1/cases/{id}/escalate
    API->>DB: Update state to ESCALATED + record audit_log
    API-->>CD: 200 OK
    CD->>Q: Redirect to Alert Queue
    T->>Q: Filter Queue for ESCALATED cases
    Q->>CD: Open Escalated Case
    CD->>API: GET /api/v1/cases/{id}
    API->>DB: Fetch complete case history & Reviewer rationale
    API-->>CD: Return complete context
    CD->>T: Render full investigation trail
    T->>CD: Author resolution & click RESOLVE
    CD->>API: POST /api/v1/cases/{id}/resolve
    API->>DB: Mark RESOLVED, insert Knowledge Base precedent
    API-->>CD: 200 OK
```

---

## 6. Key Features & Interface Design

* **Telemetry & Radar Dashboard**: Real-time velocity oscilloscope, 24-hour transaction volume metrics, SLA compliance gauges, and concentric triage ring charts.
* **Prioritized Alert Queue**: Urgent SLA sorting, state filter tabs, fast entity search, and automated background scan sweeps.
* **Knowledge Base & Precedent Library**: Searchable database of resolved incidents with category filter chips, expandable forensic post-mortems, and one-click citation copying.
* **Playbook Rules Engine**: Team Lead authoring portal for custom rule conditions that generate actionable analyst recommendations.
* **Modern Dark-Theme Aesthetic**: Sleek near-black palette (`#08090C`), light blue/cyan accents (`#38BDF8`), soft translucent borders, and responsive layouts.

---

## 7. Operational Impact & Key Metrics

EarlyBird measures system performance across five core metrics:

| Metric | Target | Description |
| :--- | :--- | :--- |
| **Mean Time to Detect (MTTD)** | `< 15 mins` | Time from transaction ingestion to anomaly detection. |
| **Mean Time to Resolve (MTTR)** | `< 2 hours` | Time from alert creation to final resolution. |
| **Knowledge Base Coverage** | `100%` | Percentage of resolved cases automatically generating searchable precedents. |
| **Alert Deduplication Efficiency** | `> 40%` | Reduction in raw alert volume via intelligent merging. |
| **SLA Acknowledgment Compliance** | `> 95%` | Percentage of alerts acknowledged within the designated window. |

---

## 8. Technology Stack

### Backend
![Python](https://img.shields.io/badge/Python_3.11-3776AB?style=for-the-badge&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy_2.0-D71F00?style=for-the-badge&logo=python&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL_15-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![Alembic](https://img.shields.io/badge/Alembic-6C757D?style=for-the-badge&logo=python&logoColor=white)
![APScheduler](https://img.shields.io/badge/APScheduler-4B5563?style=for-the-badge&logo=python&logoColor=white)
![Uvicorn](https://img.shields.io/badge/Uvicorn-499848?style=for-the-badge&logo=python&logoColor=white)
![Pytest](https://img.shields.io/badge/Pytest-0A9EDC?style=for-the-badge&logo=pytest&logoColor=white)

### Frontend
![React](https://img.shields.io/badge/React_18-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![Chart.js](https://img.shields.io/badge/Chart.js-FF6384?style=for-the-badge&logo=chartdotjs&logoColor=white)
![Anime.js](https://img.shields.io/badge/Anime.js-FF4B4B?style=for-the-badge&logo=javascript&logoColor=white)
![Lucide Icons](https://img.shields.io/badge/Lucide_Icons-F56565?style=for-the-badge&logo=feather&logoColor=white)

### Orchestration & Infrastructure
![Docker](https://img.shields.io/badge/Docker_Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![npm](https://img.shields.io/badge/npm-CB3837?style=for-the-badge&logo=npm&logoColor=white)

---

## 9. Getting Started & Local Setup

### Prerequisites
* **Python**: 3.11+
* **Node.js**: v18+ & `npm`
* **PostgreSQL**: 15+ running on `localhost:5432`

### 1. Database Setup
Create PostgreSQL user and database:
```sql
CREATE USER earlybird WITH PASSWORD 'earlybird_dev';
CREATE DATABASE earlybird_db OWNER earlybird;
```

### 2. Backend Setup
```bash
# Navigate to backend directory
cd backend

# Activate virtual environment
..\venv\Scripts\activate  # Windows
source ../venv/bin/activate  # Linux/macOS

# Run database migrations
python -m alembic upgrade head

# Start FastAPI dev server
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. Frontend Setup
```bash
# Navigate to frontend directory
cd frontend

# Install dependencies (if needed)
npm install

# Start local server
node server.js
```

The web application will be accessible at **[http://localhost:3000](http://localhost:3000)** and the API documentation at **[http://localhost:8000/docs](http://localhost:8000/docs)**.

---

## License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for full details.
