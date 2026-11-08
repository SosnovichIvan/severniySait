#!/usr/bin/env bash
set -euo pipefail
version="${1:?Usage: ./scripts/deploy.sh MAJOR.MINOR.PATCH SCHEDULED_UTC}"
[[ "$version" =~ ^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$ ]] || exit 2
cd "$(dirname "$0")/.."
exec 9>"${DEPLOY_LOCK_FILE:-/run/lock/severniy-deploy.lock}"
flock -n 9 || { echo "Another deployment is already running." >&2; exit 4; }
# .env on the VPS owns secrets; never overwrite it from CI.
export RELEASE_TAG="$version"
./scripts/check-deploy-time.sh "${2:?An explicitly scheduled UTC time is required}"
docker compose config --quiet
docker compose pull app
./scripts/check-deploy-time.sh "$2"
docker compose up -d --wait --wait-timeout 120
