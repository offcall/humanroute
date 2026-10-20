#!/usr/bin/env bash
# Opt-in devnet e2e: start the gateway on a free port, run the silent demo agent and expect a
# confirmed on-chain refund within SLA_SECONDS + 90 s.
# Exit codes: 0 pass, 1 fail, 2 missing prerequisites (keys/ or .env).
set -euo pipefail
cd "$(dirname "$0")/.."

envval() { grep -E "^$1=" .env | tail -n1 | cut -d= -f2- || true; }

missing=()
[ -f .env ] || missing+=(.env)
for name in HOLD AGENT EXPERT; do
  path="$( [ -f .env ] && envval "${name}_KEYPAIR_PATH" || true )"
  path="${path:-keys/$(echo "$name" | tr '[:upper:]' '[:lower:]').json}"
  [ -f "$path" ] || missing+=("$path")
done
if [ "${#missing[@]}" -gt 0 ]; then
  echo "e2e-devnet: missing ${missing[*]}" >&2
  echo "run: cp .env.example .env && npm run setup:wallets (then fund the agent with devnet USDC)" >&2
  echo "no devnet USDC for the agent: npm run setup:wallets -- --fallback-mint, then set USDC_MINT=<test mint from keys/test-mint.json> in .env" >&2
  exit 2
fi

SLA="$(envval SLA_SECONDS)"; SLA="${SLA:-60}"
if ! [[ "$SLA" =~ ^[0-9]+$ ]]; then echo "e2e-devnet: SLA_SECONDS is not an integer: $SLA" >&2; exit 2; fi
LIMIT=$((SLA + 90))
PORT="$(node -e 'const s=require("net").createServer();s.listen(0,"127.0.0.1",()=>{console.log(s.address().port);s.close()})')"
GATEWAY="http://127.0.0.1:$PORT"

SERVER_LOG="$(mktemp)"
DEMO_LOG="$(mktemp)"
PORT="$PORT" setsid npm start >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!
cleanup() { kill -- "-$SERVER_PID" 2>/dev/null || true; }
trap cleanup EXIT

fail() { echo "FAIL: $1"; echo "--- server log (tail) ---"; tail -n 30 "$SERVER_LOG"; exit 1; }

ready=0
for _ in $(seq 1 30); do
  if curl -s -o /dev/null "$GATEWAY/"; then ready=1; break; fi
  kill -0 "$SERVER_PID" 2>/dev/null || fail "server exited during startup"
  sleep 1
done
[ "$ready" -eq 1 ] || fail "server did not answer on $GATEWAY within 30 s"

echo "running silent demo against $GATEWAY (limit ${LIMIT}s)..."
set +e
GATEWAY_URL="$GATEWAY" timeout "$LIMIT" npx tsx --env-file=.env agent/demo.ts --silent 2>&1 | tee "$DEMO_LOG"
demo_status=${PIPESTATUS[0]}
set -e

[ "$demo_status" -ne 124 ] || fail "no confirmed refund within ${LIMIT}s (timeout)"
[ "$demo_status" -eq 0 ] || fail "demo agent exited with $demo_status"
grep -q 'refund \[confirmed\]' "$DEMO_LOG" || fail "demo finished without a confirmed refund"
echo "PASS: refund confirmed within SLA+90s"
