#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# First deployment has no application or data yet.
[[ -n "$(docker compose ps -q app)" ]] || exit 0
backup_dir="/var/backups/severniy/$(date -u +%Y%m%dT%H%M%SZ)"
install -d -m 0700 "$backup_dir"
docker compose stop app
trap 'docker compose start app' EXIT
data_dir="$(docker volume inspect severniy_portal-data --format '{{.Mountpoint}}')"
upload_dir="$(docker volume inspect severniy_portal-uploads --format '{{.Mountpoint}}')"
sqlite3 "$data_dir/portal.sqlite" ".backup '$backup_dir/portal.sqlite'"
tar -C "$upload_dir" -czf "$backup_dir/uploads.tar.gz" .
test "$(sqlite3 "$backup_dir/portal.sqlite" 'PRAGMA integrity_check;')" = ok
printf 'Consistent backup saved: %s\n' "$backup_dir"
