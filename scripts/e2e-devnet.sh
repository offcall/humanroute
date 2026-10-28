#!/usr/bin/env bash
# Opt-in devnet e2e: start the gateway on a free port with run-local env overrides (fresh DB,
# TIMER_MODE=video, FEE_WALLET from keys/fee.json), then run scripts/e2e-flow.ts: SIWS sign-in,
# order, x402 payment, claim, approve, reject, payout and refunds, checked on chain.
# Exit codes: 0 pass, 1 fail, 2 missing prerequisites (keys/hold.json or keys/agent.json).
set -euo pipefail
cd "$(dirname "$0")/.."

envval() { [ -f .env ] && grep -E "^$1=" .env | tail -n1 | cut -d= -f2- || true; }

keypath() {
  local name="$1" fallback="$2"
  local path="${!name:-}"
  [ -n "$path" ] || path="$(envval "$name")"
  echo "${path:-$fallback}"
}

HOLD_KEYPAIR_PATH="$(keypath HOLD_KEYPAIR_PATH keys/hold.json)"
AGENT_KEYPAIR_PATH="$(keypath AGENT_KEYPAIR_PATH keys/agent.json)"

missing=()
for path in "$HOLD_KEYPAIR_PATH" "$AGENT_KEYPAIR_PATH"; do
  [ -f "$path" ] || missing+=("$path")
done
if [ "${#missing[@]}" -gt 0 ]; then
  echo "e2e-devnet: missing ${missing[*]}" >&2
  echo "run: npm run setup:wallets" >&2
  exit 2
fi

FEE_WALLET="$(npx tsx scripts/fee-pubkey.ts | tail -n1)"

PORT="$(node -e 'const s=require("net").createServer();s.listen(0,"127.0.0.1",()=>{console.log(s.address().port);s.close()})')"
GATEWAY="http://127.0.0.1:$PORT"
DB_DIR="$(mktemp -d)"
SERVER_LOG="$(mktemp)"

export PORT FEE_WALLET HOLD_KEYPAIR_PATH AGENT_KEYPAIR_PATH
export PUBLIC_BASE_URL="$GATEWAY" MCP_PUBLIC_URL="$GATEWAY/mcp" TIMER_MODE=video
export DB_PATH="$DB_DIR/e2e.db"

setsid npx tsx --env-file-if-exists=.env src/index.ts >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!
cleanup() { kill -- "-$SERVER_PID" 2>/dev/null || true; rm -rf "$DB_DIR"; }
trap cleanup EXIT

fail() { echo "FAIL: $1"; echo "--- server log (tail) ---"; tail -n 30 "$SERVER_LOG"; exit 1; }

ready=0
for _ in $(seq 1 30); do
  if curl -s -o /dev/null "$GATEWAY/health"; then ready=1; break; fi
  kill -0 "$SERVER_PID" 2>/dev/null || fail "server exited during startup"
  sleep 1
done
[ "$ready" -eq 1 ] || fail "server did not answer on $GATEWAY within 30 s"

echo "running the order, payout and refund flow against $GATEWAY..."
set +e
GATEWAY_URL="$GATEWAY" npx tsx --env-file-if-exists=.env scripts/e2e-flow.ts
flow_status=$?
set -e

[ "$flow_status" -eq 0 ] || fail "e2e-flow exited with $flow_status"
echo "PASS: payout and refunds confirmed on devnet"
