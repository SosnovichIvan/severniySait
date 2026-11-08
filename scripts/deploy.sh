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
if [[ -x ./scripts/backup.sh ]]; then ./scripts/backup.sh; fi
docker compose up -d --wait --wait-timeout 120
# Persist only the verified version; credentials remain owned by the VPS.
if [[ -f .env ]]; then
  python3 - "$version" <<'PYCODE'
import os, re, sys
from pathlib import Path
path = Path('.env')
text = path.read_text()
line = 'RELEASE_TAG=' + sys.argv[1]
text = re.sub(r'^RELEASE_TAG=.*$', line, text, flags=re.M) if re.search(r'^RELEASE_TAG=', text, re.M) else text.rstrip() + '\n' + line + '\n'
temporary = Path('.env.next')
fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
with os.fdopen(fd, 'w') as target:
    target.write(text)
os.replace(temporary, path)
PYCODE
fi
