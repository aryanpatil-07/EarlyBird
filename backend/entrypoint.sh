#!/bin/bash
set -e

echo "========================================"
echo "EarlyBird Startup Sequence"
echo "========================================"

echo ""
echo "[1/5] Running database migrations..."
alembic upgrade head
echo "[✓] Migrations complete"

echo ""
echo "[2/5] Loading seed data..."
if [ -f "./data/creditcard.csv" ]; then
    echo "    Found creditcard.csv, loading 10,000 transactions..."
    python -m scripts.load_kaggle_dataset "./data/creditcard.csv" 10000
    echo "[✓] Seed data loaded successfully"
else
    echo "    Warning: ./data/creditcard.csv not found"
    echo "    Continuing without seed data (database schema created but empty)"
fi

echo ""
echo "[3/5] Seeding playbook rules..."
if [ -f "./app/fixtures/seed_playbook_rules.json" ]; then
    echo "    Found playbook rules fixture, loading into database..."
    python -m scripts.seed_playbook_rules
    echo "[✓] Playbook rules seeded"
else
    echo "    Warning: playbook rules fixture not found"
fi

echo ""
echo "[4/5] Waiting for scheduler warmup..."
sleep 2

echo ""
echo "[5/5] Starting EarlyBird API server..."
echo "    API: http://0.0.0.0:8000"
echo "    Docs: http://0.0.0.0:8000/docs"
echo "========================================"
echo ""

exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
