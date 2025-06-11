#!/usr/bin/env bash
set -euo pipefail

# ─── Configuration ────────────────────────────────────────────────────────────
IMAGE="acurast-processor-management-backend"
# PLATFORM="linux/arm64/v8"
# PLATFORM x86_64
PLATFORM="linux/amd64"
TAR="${IMAGE}.tar"

REMOTE_USER="administrator"
REMOTE_HOST="185.178.192.95"
REMOTE="${REMOTE_USER}@${REMOTE_HOST}"
DEST="/home/administrator/dockerapps/processor-management.acurast.com"
SSH_PORT="60022"

RSYNC_OPTS="-avzI --progress -e ssh -p ${SSH_PORT}"   # -I (--ignore-times) forces overwrite even if timestamps match

# ─── 1) Build & save locally ──────────────────────────────────────────────────
echo "→ Building ${IMAGE} for ${PLATFORM}…"
docker build --platform "${PLATFORM}" -t "${IMAGE}" .

echo "→ Saving image to ${TAR}…"
docker save -o "${TAR}" "${IMAGE}"
chmod 777 "${TAR}"

# ─── 2) Transfer to remote ────────────────────────────────────────────────────
echo "→ Sending ${TAR} to ${REMOTE}:${DEST} (overwrite if exists)…"
rsync -avzI --progress -e "ssh -p ${SSH_PORT}" "${TAR}" "${REMOTE}:${DEST}"

echo "→ Sending docker-compose.yml to ${REMOTE}:${DEST}…"
rsync -avzI --progress -e "ssh -p ${SSH_PORT}" docker-compose.yml "${REMOTE}:${DEST}"

# ─── 3) Load & restart on remote ─────────────────────────────────────────────
echo "→ Loading image and restarting containers on remote…"
ssh -p ${SSH_PORT} "${REMOTE}" bash <<EOF
  set -euo pipefail
  cd "${DEST}"
  echo "  • Removing old image…"
  docker rmi -f "${IMAGE}:latest" || true
  echo "  • Loading new image from ${TAR}…"
  docker load --input "${TAR}"
  echo "  • Restarting via Docker Compose…"
  docker compose stop
  docker compose up -d
EOF

echo "✔ Deployment complete."

