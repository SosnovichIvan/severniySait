#!/usr/bin/env bash
set -euo pipefail
scheduled_at="${1:?An explicitly scheduled UTC time is required}"
[[ "$scheduled_at" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?Z$ ]] || exit 2
scheduled_seconds="$(date -u -d "$scheduled_at" +%s)"
now_seconds="$(date -u +%s)"
if (( now_seconds < scheduled_seconds || now_seconds > scheduled_seconds + 600 )); then
  echo 'Deployment blocked: launch is allowed only within 10 minutes after the explicitly scheduled time.' >&2
  exit 3
fi
