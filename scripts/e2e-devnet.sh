#!/usr/bin/env bash
# Opt-in devnet e2e: start the gateway on a free port, then create a draft with the firm's MCP token
# and pay it with the agent keypair (scripts/create-order.ts). Needs FIRM_MCP_TOKEN in the environment.
# Exit codes: 0 pass, 1 fail, 2 missing prerequisites (.env, keys/ or FIRM_MCP_TOKEN).
set -euo pipefail
cd "$(dirname "$0")/.."

envval() { grep -E "^$1=" .env | tail -n1 | cut -d= -f2- || true; }

missing=()
[ -f .env ] || missing+=(.env)
[ -n "${FIRM_MCP_TOKEN:-}" ] || missing+=(FIRM_MCP_TOKEN)
for name in HOLD AGENT; do
  path="$( [ -f .env ] && envval "${name}_KEYPAIR_PATH" || true )"
  path="${path:-keys/$(echo "$name" | tr '[:upper:]' '[:lower:]').json}"
  [ -f "$path" ] || missing+=("$path")
done
if [ "${#missing[@]}" -gt 0 ]; then
  echo "e2e-devnet: missing ${missing[*]}" >&2
  echo "run: cp .env.example .env && npm run setup:wallets, then export FIRM_MCP_TOKEN=<token from the firm cabinet>" >&2
  exit 2
fi

PORT="$(node -e 'const s=require("net").createServer();s.listen(0,"127.0.0.1",()=>{console.log(s.address().port);s.close()})')"
GATEWAY="http://127.0.0.1:$PORT"

SERVER_LOG="$(mktemp)"
ORDER_LOG="$(mktemp)"
PORT="$PORT" setsid npm start >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!
cleanup() { kill -- "-$SERVER_PID" 2>/dev/null || true; }
trap cleanup EXIT

fail() { echo "FAIL: $1"; echo "--- server log (tail) ---"; tail -n 30 "$SERVER_LOG"; exit 1; }

ready=0
for _ in $(seq 1 30); do
  if curl -s -o /dev/null "$GATEWAY/health"; then ready=1; break; fi
  kill -0 "$SERVER_PID" 2>/dev/null || fail "server exited during startup"
  sleep 1
done
[ "$ready" -eq 1 ] || fail "server did not answer on $GATEWAY within 30 s"

echo "creating and paying one order against $GATEWAY..."
set +e
GATEWAY_URL="$GATEWAY" npx tsx --env-file=.env scripts/create-order.ts 2>&1 | tee "$ORDER_LOG"
order_status=${PIPESTATUS[0]}
set -e

[ "$order_status" -eq 0 ] || fail "create-order exited with $order_status"
echo "PASS: order created and paid (payout and refund are checked in the gateway log)"
