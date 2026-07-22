# EarlyBird — Documentation Index

**EarlyBird** is a transaction fraud anomaly detection platform with a focus on root cause analysis, auto-generated documentation, explicit communication, and intelligent alert triage. Built by a solo developer over 8 weeks using Python/FastAPI, PostgreSQL, and React/Next.js.

## One-Paragraph Summary

EarlyBird detects anomalous credit card transactions against a rolling baseline, provides explainable root cause links (correlated activities that plausibly explain each anomaly), and routes them through a two-tier triage system: REVIEWER analysts accept/reject/escalate cases; TEAM_LEAD resolves escalations and authors playbook rules that guide future reviewer decisions. Every decision is audited and every resolved case automatically generates a knowledge base entry, making the system a growing institutional record of fraud patterns and resolutions, not just a sequence of individual alerts.

**Getting started:** See [`LOCAL_SETUP.md`](LOCAL_SETUP.md) for local development setup. For project design & architecture, read the documentation in [`docs/`](docs/) — start with [`docs/01-vision-and-problem-statement.md`](docs/01-vision-and-problem-statement.md).

## Reading Order

Start here if you're **coming in cold** (first time reading the project):

1. **`01-Vision-and-Problem-Statement.md`** — Project scope, the four core focus areas (RCA, Documentation, Communication, Alert Triage), what's built and what's deliberately cut, and the design principles that guide everything below.
2. **`02-Product-Requirements-Document.md`** — Functional and non-functional requirements, user personas (REVIEWER and TEAM_LEAD), and the acceptance criteria for each major feature.
3. **`03-UX-Design.md`** — User experience flows, screen-level interactions, edge cases, and two Mermaid diagrams showing the happy-path and escalation journeys.
4. **`04-System-Architecture-and-Design.md`** — Why a modular monolith (not microservices) at this scale, component boundaries, technology choices, and what-was-cut-and-why.
5. **`05-Backend-Component-Design.md`** — Implementation-level details: module structure, core algorithms (detection, de-duplication, state machine), concurrency handling, and error patterns.
6. **`06-Database-Design.md`** — Entity-relationship diagram, table-by-table schema, normalization approach (3NF + two justified JSONB/denormalization departures), and indexes.
7. **`07-API-Specification.md`** — REST endpoint contracts, request/response schemas, error codes, and authentication/authorization enforcement points.
8. **`08-Build-and-Deployment-Plan.md`** — Local development setup, testing strategy, Docker Compose orchestration, and deployment to staging/production.

### Alternative Reading Paths

**If you want to understand the system's behavior first:**
- Start with `03-UX-Design.md` (read §13's Mermaid diagrams first) → then `02-Product-Requirements-Document.md` → then `01-Vision-and-Problem-Statement.md` for the "why."

**If you're implementing a specific component:**
- `05-Backend-Component-Design.md` (find your component) → `06-Database-Design.md` (schema for that component) → `07-API-Specification.md` (endpoints for that component) → `04-System-Architecture-and-Design.md` (where this component sits in the larger flow).

**If you're reviewing the architecture:**
- `04-System-Architecture-and-Design.md` → `06-Database-Design.md` → `07-API-Specification.md`.

## Key Files Across the Docs

| Concept | Primary Source | Secondary Source |
|---|---|---|
| Project scope and focus areas | 01-Vision | 02-PRD §2 |
| User roles and personas | 02-PRD §3 | 03-UX §2 |
| Fraud detection approach | 01-Vision §3 | 05-Backend §2 |
| Root cause analysis | 01-Vision §3 | 05-Backend §4, 06-Database §3.5 |
| Alert de-duplication | 02-PRD FR-051 | 05-Backend §3 |
| Playbook rules engine | 02-PRD FR-052-053 | 03-UX §8 |
| Case state machine | 05-Backend §4 | 06-Database §3.7 |
| Knowledge base auto-generation | 01-Vision §4 | 05-Backend §5 |
| Escalation and audit trail | 02-PRD FR-060-061, §4 | 03-UX §7 |
| API authentication/authorization | 07-API §1 | 02-PRD §5 |
| Deployment & local dev setup | 08-Build | — |

## Mermaid Diagrams

The docs include the following diagrams for quick visual reference:

- **`03-UX-Design.md` §13:** Two sequence diagrams showing the happy-path (REVIEWER accepts a case) and escalation-path (REVIEWER escalates to TEAM_LEAD for resolution).
- **`06-Database-Design.md` §1:** Entity-relationship diagram showing all tables and their relationships.

## What Was Cut (And Why)

This is a solo developer + 8-week project. The following enterprise-scale elements were deliberately cut:

| Enterprise Feature | Cut? | Reasoning |
|---|---|---|
| Multi-vertical fraud support (purchase, refund, velocity, etc.) | ✅ Cut | Credit card fraud only; 8 weeks, one person, one dataset |
| Predictive modeling & ML re-training pipeline | ✅ Cut | Rule-based playbooks sufficient for human-in-the-loop triage |
| Multi-tenant SaaS isolation | ✅ Cut | Single-tenant (you); no schema-per-tenant logic |
| Kubernetes / multi-region deployment | ✅ Cut | Docker Compose on one machine is honest and sufficient |
| Redis (cache/streams/queue) | ✅ Cut | Scheduled jobs can recompute from Postgres without a cache layer |
| Real-time sub-second alerting | ✅ Cut | Batch detection + periodic de-duplication + human review is the right SLA |
| Compliance export (SOC2, PCI-DSS) | ✅ Cut | Audit trail + read-only access + hard-deletion constraints sufficient for internal review |
| OAuth2/SAML integration | ✅ Cut | In-database users (REVIEWER/TEAM_LEAD roles) sufficient |
| Autonomous ML-driven decisions | ✅ Cut | Every anomaly action is explicit, human, audited |
| Playbook ML-recommendation source | ✅ Cut | Rule-based recommendations only; no learned patterns |

**What's kept:** Root cause analysis, auto-generated documentation, explicit escalation/audit trails, and intelligent alert de-duplication (triage) — the core four focus areas from the vision.

## Open Questions

Refer to the "Open Design Questions" section at the end of each doc for unresolved decisions flagged during design. Cross-doc open questions are tracked in **`docs/SYNTHESIS_NOTES.md`**.

## File Status

| Document | Status | Last Updated |
|---|---|---|
| 01-Vision-and-Problem-Statement.md | ✅ Draft v1 | [Your date] |
| 02-Product-Requirements-Document.md | ✅ Draft v1 | [Your date] |
| 03-UX-Design.md | ✅ Draft v1 | [Your date] |
| 04-System-Architecture-and-Design.md | ✅ Draft v1 | [Your date] |
| 05-Backend-Component-Design.md | ✅ Draft v1 | [Your date] |
| 06-Database-Design.md | ✅ Draft v1 | [Your date] |
| 07-API-Specification.md | ✅ Draft v1 | [Your date] |
| 08-Build-and-Deployment-Plan.md | ✅ Draft v1 | [Your date] |

## How to Use These Docs

- **For implementation:** Use `05-Backend-Component-Design.md` as your pseudocode, `06-Database-Design.md` as your schema, and `07-API-Specification.md` as your API contract.
- **For interviews:** Walk through `01-Vision` + `04-System-Architecture`, then dive into `05-Backend` for one component that impressed you.
- **For handoff:** Start someone else with `02-PRD` + `03-UX`, then point them to the technical docs based on their area of focus.
- **For change requests:** Update the docs that are affected, trace through cross-doc dependencies (e.g., a new field in the schema affects the API spec, which affects the UX), and re-verify consistency.

---

**Next step:** Start with [`01-Vision-and-Problem-Statement.md`](01-Vision-and-Problem-Statement.md).
