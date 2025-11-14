#!/bin/bash
#
# Copy Test Assets to Public Directory
#
# This script copies test assets from the assets/ directory to public/assets/
# so they can be served by Vite in both development and production.
#
# Usage: ./scripts/copy-test-assets.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "Copying test assets to public directory..."

# Create directories
mkdir -p "$PROJECT_ROOT/public/assets/test-data"
mkdir -p "$PROJECT_ROOT/public/assets/test-audio"
mkdir -p "$PROJECT_ROOT/public/assets/test-images"

# Copy test data
cp "$PROJECT_ROOT/assets/test-data/concerts.json" "$PROJECT_ROOT/public/assets/test-data/"
echo "✓ Copied test data (concerts.json)"

# Copy test audio
cp "$PROJECT_ROOT/assets/test-audio"/*.mp3 "$PROJECT_ROOT/public/assets/test-audio/"
echo "✓ Copied test audio files"

# Copy test images
cp "$PROJECT_ROOT/assets/test-images"/*.jpg "$PROJECT_ROOT/public/assets/test-images/"
echo "✓ Copied test images"

echo ""
echo "Test assets copied successfully!"
echo "Test mode will now work correctly when enabled in Secret Settings."
