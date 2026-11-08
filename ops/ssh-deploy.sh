#!/usr/bin/env bash
set -euo pipefail
# Forced command for a dedicated key. No shell, forwarding, uploads or arbitrary paths.
command_text="${SSH_ORIGINAL_COMMAND:-}"
if [[ "$command_text" =~ ^deploy\ ((0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*))\ ([0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z)$ ]]; then
  exec sudo -n /opt/severniySait/scripts/deploy.sh "${BASH_REMATCH[1]}" "${BASH_REMATCH[5]}"
fi
echo 'Only deploy MAJOR.MINOR.PATCH SCHEDULED_UTC is allowed.' >&2
exit 2
