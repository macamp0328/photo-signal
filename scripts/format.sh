#!/bin/bash
# Format script - formats code with Prettier

set -e

CHECK=${1:-false}

echo "🎨 Formatting code..."

if [ "$USE_DOCKER" = "true" ]; then
  echo "📦 Formatting in Docker..."
  if [ "$CHECK" = "--check" ]; then
    docker-compose run --rm dev npm run format:check
  else
    docker-compose run --rm dev npm run format
  fi
else
  echo "💻 Formatting locally..."
  if [ "$CHECK" = "--check" ]; then
    npm run format:check
  else
    npm run format
  fi
fi

echo "✅ Formatting completed!"
