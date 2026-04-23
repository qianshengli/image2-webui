#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB_DIR="$REPO_ROOT/web"
BACKEND_DIR="$REPO_ROOT/backend"

echo "[1/5] Running backend tests..."
cd "$BACKEND_DIR"
go test ./...

echo "[2/5] Ensuring frontend dependencies..."
cd "$WEB_DIR"
if [ ! -x node_modules/.bin/tsc ] || [ ! -x node_modules/.bin/eslint ] || [ ! -x node_modules/.bin/vite ]; then
  npm ci
fi

echo "[3/5] Running frontend type check..."
npx tsc --noEmit

echo "[4/5] Running frontend lint..."
npm run lint

echo "[5/5] Running frontend production build..."
npm run build

echo "Checks complete."
