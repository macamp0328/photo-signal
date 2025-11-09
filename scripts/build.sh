#!/bin/bash
# Build script - builds the application for production

set -e

echo "🔨 Building Photo Signal..."

if [ "$USE_DOCKER" = "true" ]; then
  echo "📦 Building with Docker..."
  docker-compose build prod
else
  echo "💻 Building with local npm..."
  npm run build
fi

echo "✅ Build completed successfully!"
