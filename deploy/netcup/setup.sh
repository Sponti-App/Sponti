#!/usr/bin/env sh
# One-time server setup. Run on the server as root:
#   curl -fsSL https://raw.githubusercontent.com/Sponti-App/Sponti/<branch>/deploy/netcup/setup.sh | sh
# Installs Docker, opens only SSH/HTTP/HTTPS, clones the repo to /opt/sponti
# and creates the env files to fill in. Safe to re-run.
set -eu

REPO_URL=https://github.com/Sponti-App/Sponti.git
BRANCH=${BRANCH:-main}
DIR=/opt/sponti

if command -v apt-get >/dev/null 2>&1; then
  apt-get update -qq
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq git curl ufw >/dev/null
fi

if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi

if command -v ufw >/dev/null 2>&1; then
  ufw allow OpenSSH
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw allow 443/udp
  ufw --force enable
fi

if [ ! -d "$DIR/.git" ]; then
  git clone --branch "$BRANCH" "$REPO_URL" "$DIR"
fi

cd "$DIR/deploy/netcup"
for f in env api.env auth.env; do
  target=$([ "$f" = env ] && echo .env || echo "$f")
  if [ ! -f "$target" ]; then
    cp "$f.example" "$target"
    chmod 600 "$target"
    echo "created $DIR/deploy/netcup/$target: fill it in"
  fi
done

echo "Next: fill in api.env and auth.env, then run $DIR/deploy/netcup/deploy.sh"
