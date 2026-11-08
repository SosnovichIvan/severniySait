#!/usr/bin/env bash
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
. /etc/os-release
[[ "$ID" = ubuntu && "$VERSION_ID" = 24.04 ]]
cloud-init status --wait || test "$(cloud-init status --format json | python3 -c 'import sys,json;print(json.load(sys.stdin)["status"])')" = done
apt-get -o DPkg::Lock::Timeout=300 update
apt-get -o DPkg::Lock::Timeout=300 install -y ca-certificates curl sqlite3 rsync util-linux
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
cat > /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: noble
Components: stable
Architectures: amd64
Signed-By: /etc/apt/keyrings/docker.asc
EOF
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
install -d -m 0755 /etc/docker
if [[ ! -e /etc/docker/daemon.json ]]; then
  echo '{"log-driver":"local","log-opts":{"max-size":"10m","max-file":"3"}}' > /etc/docker/daemon.json
fi
systemctl enable --now docker
systemctl restart docker
install -d -m 0755 /opt/severniySait/scripts
install -d -m 0700 /var/backups/severniy
install -d /etc/systemd/journald.conf.d
printf '[Journal]\nSystemMaxUse=200M\n' > /etc/systemd/journald.conf.d/severniy.conf
systemctl restart systemd-journald
docker --version
docker compose version
df -h /
