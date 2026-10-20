#!/usr/bin/env bash
# E2E on devnet: start the server, run the silent agent demo, expect a confirmed refund within SLA+90 s.
set -euo pipefail
cd "$(dirname "$0")/.."

for f in keys/hold.json keys/agent.json keys/expert.json .env; do
  if [ ! -f "$f" ]; then
    echo "skipping e2e: $f missing (run npm run setup:wallets, fund devnet USDC, cp .env.example .env)"
    exit 0
  fi
done

envval() { grep -E "^$1=" .env | tail -n1 | cut -d= -f2- || true; }
SLA="$(envval SLA_SECONDS)"; SLA="${SLA:-60}"
PORT="$(envval PORT)"; PORT="${PORT:-4021}"
LIMIT=$((SLA + 90))

SERVER_LOG="$(mktemp)"; DEMO_LOG="$(mktemp)"
npm start >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!
cleanup() { pkill -P "$SERVER_PID" 2>/dev/null || true; kill "$SERVER_PID" 2>/dev/null || true; }
trap cleanup EXIT

for _ in $(seq 1 30); do
  curl -fs "http://localhost:$PORT/health" >/dev/null 2>&1 && break
  sleep 1
done
if ! curl -fs "http://localhost:$PORT/health" >/dev/null 2>&1; then
  echo "FAIL: server did not become healthy"; tail -n 30 "$SERVER_LOG"; exit 1
fi

echo "running silent demo (limit ${LIMIT}s)..."
timeout "$LIMIT" npm run demo:silent 2>&1 | tee "$DEMO_LOG" || true

if grep -q 'refund \[confirmed\]' "$DEMO_LOG"; then
  echo "PASS: refund confirmed within SLA+90s"
  exit 0
fi
echo "FAIL: no confirmed refund within ${LIMIT}s"; tail -n 30 "$SERVER_LOG"; exit 1
