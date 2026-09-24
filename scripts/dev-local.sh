#!/usr/bin/env bash
# Same as scripts/dev.sh, but against a private local MongoDB (data kept in
# .local-mongo/) instead of the shared Atlas cluster in the .env files, then
# seeds the demo accounts. Nothing here touches Atlas.
#
#   scripts/dev-local.sh           # start local db + all three servers + seed
#   scripts/dev-local.sh --reset   # wipe the local db first
set -uo pipefail
set -m

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MONGO_PORT=27018
pids=()

cleanup() {
    trap - INT TERM EXIT
    for pid in "${pids[@]:-}"; do
        [ -n "$pid" ] && kill -TERM -- "-$pid" >/dev/null 2>&1
    done
    wait 2>/dev/null
}
trap cleanup INT TERM EXIT

if [ "${1:-}" = "--reset" ]; then
    rm -rf "$ROOT_DIR/.local-mongo"
    printf '\033[1;33m[local] wiped .local-mongo\033[0m\n'
fi

if lsof -nP -iTCP:$MONGO_PORT -sTCP:LISTEN >/dev/null 2>&1; then
    printf '\033[1;31m[local] port %s is already in use (another dev-local.sh running?)\033[0m\n' "$MONGO_PORT" >&2
    exit 1
fi

node "$ROOT_DIR/scripts/local-mongo.mjs" 2>&1 | sed -u $'s/^/\033[32m[mongo]\033[0m /' &
pids+=($!)

printf '[local] waiting for mongo (first run downloads a binary)...\n'
for _ in $(seq 1 180); do
    lsof -nP -iTCP:$MONGO_PORT -sTCP:LISTEN >/dev/null 2>&1 && break
    sleep 1
done
lsof -nP -iTCP:$MONGO_PORT -sTCP:LISTEN >/dev/null 2>&1 || { echo "[local] mongo did not start" >&2; exit 1; }

# Values already in the environment win over `node --env-file=.env`, so this
# redirects both servers without editing (or backing up) the .env files.
export MONGO_URI="mongodb://127.0.0.1:$MONGO_PORT/?replicaSet=rs0"
export DB_NAME="sponti_local"

"$ROOT_DIR/scripts/dev.sh" &
pids+=($!)

# Seed once both servers answer /health (idempotent, so restarts are fine).
(
    for _ in $(seq 1 120); do
        curl -fs http://localhost:3002/health >/dev/null 2>&1 \
            && curl -fs http://localhost:4000/health >/dev/null 2>&1 && break
        sleep 1
    done
    node "$ROOT_DIR/scripts/seed-demo-accounts.mjs" 2>&1 | sed -u $'s/^/\033[1;32m[seed]\033[0m /'
) &

wait
