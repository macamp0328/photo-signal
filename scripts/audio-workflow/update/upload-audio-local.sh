#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
ENV_FILE="${REPO_ROOT}/.env.local"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "❌ .env.local not found at ${ENV_FILE}. Copy .env.example and fill in your credentials." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "${ENV_FILE}"
set +a

node "${REPO_ROOT}/scripts/audio-workflow/update/upload-to-r2.js" "$@"
