#!/bin/bash
# Test script - runs all tests

set -e

echo "🧪 Running tests..."

if [ "$USE_DOCKER" = "true" ]; then
  echo "📦 Running tests in Docker..."
  docker-compose run --rm dev npm test -- --run
else
  echo "💻 Running tests locally..."
  npm test -- --run
fi

echo "✅ All tests passed!"
