#!/usr/bin/env sh
# Build and (re)start the backends from the latest commit of DEPLOY_BRANCH.
# On the server:  /opt/sponti/deploy/netcup/deploy.sh
# From a laptop:  ssh root@152.53.198.143 /opt/sponti/deploy/netcup/deploy.sh
set -eu

cd "$(dirname "$0")"
# Which branch the server runs: DEPLOY_BRANCH in .env, else main.
BRANCH=$(sed -n 's/^DEPLOY_BRANCH=//p' .env 2>/dev/null)
BRANCH=${BRANCH:-main}

git fetch --quiet origin "$BRANCH"
git checkout --quiet "$BRANCH"
git reset --quiet --hard "origin/$BRANCH"

docker compose up -d --build --remove-orphans
docker image prune -f >/dev/null

docker compose ps
