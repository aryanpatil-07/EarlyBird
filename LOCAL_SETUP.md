# Local Setup — EarlyBird Phase 0

This file explains how to set up your local development environment. It is **not committed to git** — it's for your reference only.

## Quick Start

### 1. Docker Compose

Start all services:
```bash
docker compose up -d
```

Verify:
```bash
docker ps
```

You should see three containers:
- `earlybird-postgres`
- `earlybird-backend`
- `earlybird-frontend`

### 2. Verify Health Check

```bash
curl http://localhost:8000/health
```

Expected:
```json
{"status": "ok", "service": "EarlyBird API"}
```

### 3. Load Kaggle Dataset

Download `creditcard.csv` from Kaggle (save to `data/creditcard.csv` — not committed).

```bash
python scripts/load_kaggle_dataset.py data/creditcard.csv
```

Or for testing:
```bash
python scripts/load_kaggle_dataset.py data/creditcard.csv 10000
```

### 4. Backend Tests

```bash
cd backend
pytest tests/ -v
```

Should pass:
- `test_health_check`
- `test_root_endpoint`

### 5. Frontend (Optional)

```bash
http://localhost:3000
```

Will show a welcome screen with backend status.

## Troubleshooting

**Postgres fails to start:**
```bash
docker compose down -v
docker compose up -d
```

**Port conflict:**
Edit `docker-compose.yml` ports, or kill process on that port.

**Dataset loading fails:**
- Verify `data/creditcard.csv` exists
- Check `DATABASE_URL` in `backend/.env`

## Next Steps

Once M0 is verified:
1. Review `IMPLEMENTATION_PLAN.md` for overall structure
2. Move to **M1 — Detection Engine** (see `PHASE_EXPLANATIONS/M0_SCAFFOLDING.md`)
3. Follow `docs/git-workflow.md` for branching and commits
