#!/bin/bash
# Lint script - checks and optionally fixes code quality issues

set -e

FIX=${1:-false}

echo "🔍 Linting code..."

if [ "$USE_DOCKER" = "true" ]; then
  echo "📦 Linting in Docker..."
  if [ "$FIX" = "--fix" ]; then
    docker-compose run --rm dev npm run lint:fix
  else
    docker-compose run --rm dev npm run lint
  fi
else
  echo "💻 Linting locally..."
  if [ "$FIX" = "--fix" ]; then
    npm run lint:fix
  else
    npm run lint
  fi
fi

echo "✅ Linting completed!"
