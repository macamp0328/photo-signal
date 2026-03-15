#!/usr/bin/env bash

set -euo pipefail

echo "Installing dependencies with npm ci..."
npm ci

echo "Installing Playwright browsers and system dependencies..."
# Installs Chromium + WebKit binaries and the system libraries they need
# (apt packages: libgstreamer, libgtk-4, libgraphene, libwoff2dec, etc.)
npx playwright install --with-deps chromium webkit

echo "Running lightweight setup check (type-check)..."
npm run type-check

echo "Dev container setup complete."
