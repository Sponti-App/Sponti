#!/usr/bin/env bash
# Starts spa/, api/, and auth-server/ dev servers together with prefixed,
# color-coded output. Ctrl-C stops all three.
set -uo pipefail
set -m # each background job gets its own process group, so we can kill npm's child processes too

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

pids=()

cleanup() {
    trap - INT TERM EXIT
    for pid in "${pids[@]:-}"; do
        [ -n "$pid" ] && kill -TERM -- "-$pid" >/dev/null 2>&1
    done
    wait 2>/dev/null
}
trap cleanup INT TERM EXIT

# The LAN IP (used so a phone/Capacitor build on the same WiFi can reach this
# machine) drifts on DHCP renewal. auth-server/.env's APP_URL/CORS_ORIGINS and
# spa/.env.local's NEXT_PUBLIC_DEV_SERVER_URL hardcode it, so re-detect and
# rewrite it on every run instead of letting it go stale.
sync_lan_ip() {
    local ip
    ip="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)"

    if [ -z "$ip" ]; then
        printf '\033[1;33m[dev.sh] could not detect a LAN IP — leaving existing APP_URL / NEXT_PUBLIC_DEV_SERVER_URL as-is\033[0m\n' >&2
        return
    fi

    printf '\033[1;32m[dev.sh] LAN IP: %s (syncing APP_URL / NEXT_PUBLIC_DEV_SERVER_URL)\033[0m\n' "$ip"

    local ipv4_pattern='[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}'
    if [ -f "$ROOT_DIR/auth-server/.env" ]; then
        sed -i '' -E "s#(http://)$ipv4_pattern(:3000)#\1${ip}\2#g" "$ROOT_DIR/auth-server/.env"
    fi
    if [ -f "$ROOT_DIR/spa/.env.local" ]; then
        sed -i '' -E "s#(NEXT_PUBLIC_DEV_SERVER_URL=http://)$ipv4_pattern(:3000)#\1${ip}\2#" "$ROOT_DIR/spa/.env.local"
    fi
}

sync_lan_ip

# args: name color dir
run_service() {
    local name="$1" color="$2" dir="$3"

    if [ ! -d "$dir" ]; then
        printf '\033[1;31m[%s] missing directory: %s\033[0m\n' "$name" "$dir" >&2
        return
    fi
    if [ ! -f "$dir/.env" ] && [ "$name" != "spa" ]; then
        printf '\033[1;33m[%s] warning: %s/.env not found — dev server will likely fail to start\033[0m\n' "$name" "$dir" >&2
    fi

    (
        cd "$dir" && npm run dev 2>&1 | while IFS= read -r line; do
            printf '\033[%sm[%s]\033[0m %s\n' "$color" "$name" "$line"
        done
    ) &
    pids+=($!)
}

run_service "auth" "35" "$ROOT_DIR/auth-server"
run_service "api" "36" "$ROOT_DIR/api"
run_service "spa" "33" "$ROOT_DIR/spa"

wait
