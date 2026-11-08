#!/usr/bin/env bash
set -euo pipefail
version="${1:?Usage: ./scripts/deploy.sh MAJOR.MINOR.PATCH}"
[[ "$version" =~ ^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$ ]] || exit 2
cd "$(dirname "$0")/.."
# .env on the VPS owns secrets; never overwrite it from CI.
export RELEASE_TAG="$version"
docker compose config --quiet
docker compose pull app
docker compose up -d --wait --wait-timeout 120
