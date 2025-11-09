#!/bin/bash
# Development server script - starts the app in dev mode

set -e

echo "🚀 Starting Photo Signal in development mode..."

if [ "$USE_DOCKER" = "true" ]; then
  echo "📦 Using Docker Compose..."
  docker-compose up dev
else
  echo "💻 Using local npm..."
  npm run dev
fi
