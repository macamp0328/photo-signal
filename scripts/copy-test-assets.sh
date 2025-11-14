#!/bin/bash
#
# Copy Test Assets to Public Directory
#
# This script manually copies test assets from the assets/ directory to public/assets/.
# Normally, this is done automatically by the Vite plugin during build and dev server startup.
#
# **When to use this script:**
# - Manual testing without running dev server
# - Troubleshooting asset copying issues
# - Preparing assets for deployment without Vite
#
# **Normal usage:**
# - Run `npm run dev` or `npm run build` - the Vite plugin handles this automatically
#
# Usage: ./scripts/copy-test-assets.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "Copying test assets to public directory..."
echo "(Note: This is normally done automatically by the Vite plugin)"
echo ""

# Create directories
mkdir -p "$PROJECT_ROOT/public/assets/test-data"
mkdir -p "$PROJECT_ROOT/public/assets/test-audio"
mkdir -p "$PROJECT_ROOT/public/assets/test-images"

# Copy test data
if [ -f "$PROJECT_ROOT/assets/test-data/concerts.json" ]; then
  cp "$PROJECT_ROOT/assets/test-data/concerts.json" "$PROJECT_ROOT/public/assets/test-data/"
  echo "✓ Copied test data (concerts.json)"
else
  echo "⚠ concerts.json not found in test-data directory"
fi

# Copy test audio
if ls "$PROJECT_ROOT/assets/test-audio"/*.mp3 1> /dev/null 2>&1; then
  cp "$PROJECT_ROOT/assets/test-audio"/*.mp3 "$PROJECT_ROOT/public/assets/test-audio/"
  echo "✓ Copied test audio files"
else
  echo "⚠ No MP3 files found in test-audio directory"
fi

# Copy test images
if ls "$PROJECT_ROOT/assets/test-images"/*.jpg 1> /dev/null 2>&1; then
  cp "$PROJECT_ROOT/assets/test-images"/*.jpg "$PROJECT_ROOT/public/assets/test-images/"
  echo "✓ Copied test images"
else
  echo "⚠ No JPG files found in test-images directory"
fi

echo ""
echo "Test assets copied successfully!"
echo "Test mode will now work correctly when enabled in Secret Settings."
