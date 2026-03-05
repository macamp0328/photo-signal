#!/usr/bin/env bash

set -euo pipefail

if ! command -v apt-get >/dev/null 2>&1; then
  echo "This installer currently supports Debian/Ubuntu environments only."
  exit 1
fi

SUDO=""
if [ "$(id -u)" -ne 0 ]; then
  if command -v sudo >/dev/null 2>&1; then
    SUDO="sudo"
  else
    echo "Please run as root or install sudo."
    exit 1
  fi
fi

echo "Installing optional audio workflow tools (ffmpeg + python3-mutagen + yt-dlp)..."
$SUDO apt-get update
$SUDO apt-get install -y --no-install-recommends ffmpeg python3 python3-pip python3-venv python3-mutagen

if ! command -v yt-dlp >/dev/null 2>&1; then
  $SUDO curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
  $SUDO chmod +x /usr/local/bin/yt-dlp
fi

$SUDO apt-get clean
$SUDO rm -rf /var/lib/apt/lists/*

echo "Audio workflow tooling install complete."