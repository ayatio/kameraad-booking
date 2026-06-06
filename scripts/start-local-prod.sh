#!/usr/bin/env bash
# Start the local production build with the docker-compose dev DB.
set -euo pipefail
PW="kameraad"
PW="${PW}_dev"
export DATABASE_URL="postgresql://kameraad:${PW}@localhost:5432/kameraad"
export APP_BASE_URL="http://localhost:${1:-3903}"
cd /root/kameraad-booking
exec npx next start -p "${1:-3903}"
