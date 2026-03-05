#!/usr/bin/env bash

set -euo pipefail

if [ ! -d node_modules ] || [ -z "$(ls -A node_modules 2>/dev/null)" ]; then
  echo "Installing dependencies with npm ci..."
  npm ci
else
  echo "node_modules already present; skipping npm ci."
fi

echo "Running lightweight setup check (type-check)..."
npm run type-check

echo "Dev container setup complete."