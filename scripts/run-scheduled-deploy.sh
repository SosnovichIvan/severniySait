#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# Host-only runner. No Docker socket or deployment credentials are exposed to the web app.
exec 8>"${DEPLOY_QUEUE_LOCK_FILE:-/run/lock/severniy-queue.lock}"
flock -n 8 || exit 0
queue() { docker compose exec -T app node --import tsx scripts/deployment-queue.ts "$@"; }
# The host lock proves no earlier runner still owns an in-flight job.
queue recover
entry="$(queue claim)"
[[ -n "$entry" ]] || exit 0
IFS=$'\t' read -r job_id version scheduled_at <<< "$entry"
if ./scripts/deploy.sh "$version" "$scheduled_at"; then
  queue finish "$job_id" succeeded
else
  queue finish "$job_id" failed
  exit 1
fi
