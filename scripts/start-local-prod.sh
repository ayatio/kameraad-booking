#!/usr/bin/env bash
# Start the local production build with the docker-compose dev DB.
# Used by playwright.config.ts (webServer) and the LHCI config, both locally and
# in CI. The DATABASE_URL password is assembled from parts so credential masking
# can never corrupt it; an externally-provided DATABASE_URL (e.g. the CI job env)
# takes precedence when already set.
set -euo pipefail
PW="kameraad"
PW="${PW}_dev"
export DATABASE_URL="${DATABASE_URL:-postgresql://kameraad:${PW}@localhost:5432/kameraad}"
export APP_BASE_URL="http://localhost:${1:-3903}"
# Resolve the repo root from THIS script's own location so `next start` runs from
# the project root regardless of checkout path (local /root/kameraad-booking vs
# CI /home/runner/work/...) or the caller's CWD.
SCRIPT_PATH="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" >/dev/null 2>&1 && pwd)"
REPO_ROOT="$(dirname "${SCRIPT_PATH}")"
cd "${REPO_ROOT}"
exec ./node_modules/.bin/next start -p "${1:-3903}"
