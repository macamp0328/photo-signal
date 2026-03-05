#!/usr/bin/env bash

set -euo pipefail

echo "Installing dependencies with npm ci..."
npm ci

echo "Running lightweight setup check (type-check)..."
npm run type-check

echo "Dev container setup complete."