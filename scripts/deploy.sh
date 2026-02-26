#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/feego-admin"
SERVICE_NAME="feego-admin"
BRANCH="main"

cd "$APP_DIR"

echo "[deploy] git fetch"
git fetch --all --prune

echo "[deploy] checkout $BRANCH"
git checkout "$BRANCH"

echo "[deploy] pull"
git pull --ff-only origin "$BRANCH"

echo "[deploy] install deps"
npm ci --omit=dev

# Run DB migrations (requires .env)
echo "[deploy] migrate"
npm run migrate --silent

# Build UI (optional; cheap enough for now)
echo "[deploy] build ui"
( cd ui && npm ci && npm run build )

echo "[deploy] restart service"
systemctl restart "$SERVICE_NAME"

echo "[deploy] status"
systemctl --no-pager --full status "$SERVICE_NAME" | sed -n '1,25p'

echo "[deploy] done"
