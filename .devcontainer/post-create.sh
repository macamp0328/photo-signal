#!/usr/bin/env bash

set -euo pipefail

install_tooling_if_missing() {
  local missing=()

  if ! command -v ffmpeg >/dev/null 2>&1; then
    missing+=(ffmpeg)
  fi
  if ! command -v ffprobe >/dev/null 2>&1; then
    # ffprobe ships in the ffmpeg package on Debian/Ubuntu.
    missing+=(ffmpeg)
  fi
  if ! command -v gh >/dev/null 2>&1; then
    missing+=(gh)
  fi
  if ! command -v yt-dlp >/dev/null 2>&1; then
    missing+=(yt-dlp)
  fi
  if ! command -v python3 >/dev/null 2>&1; then
    missing+=(python3)
  fi
  if ! command -v pip3 >/dev/null 2>&1; then
    missing+=(python3-pip)
  fi
  if command -v python3 >/dev/null 2>&1; then
    if ! python3 -c 'import mutagen' >/dev/null 2>&1; then
      missing+=(python3-mutagen)
    fi
    if ! python3 -m venv --help >/dev/null 2>&1; then
      missing+=(python3-venv)
    fi
  else
    missing+=(python3-mutagen python3-venv)
  fi

  if [[ ${#missing[@]} -eq 0 ]]; then
    echo "Required CLI tooling already present (ffmpeg/ffprobe/gh/yt-dlp + python audio deps)."
    return
  fi

  # De-duplicate package names.
  mapfile -t missing < <(printf '%s\n' "${missing[@]}" | sort -u)

  echo "Installing missing CLI tooling: ${missing[*]}"

  local SUDO=""
  if [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null 2>&1; then
    SUDO="sudo"
  fi

  # If gh needs to be installed, add the GitHub CLI apt repository first.
  # gh is not in the default Debian/Ubuntu sources; this mirrors the Dockerfile setup.
  if printf '%s\n' "${missing[@]}" | grep -qx 'gh'; then
    local keyring=/usr/share/keyrings/githubcli-archive-keyring.gpg
    curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg -o /tmp/githubcli-keyring.gpg
    $SUDO mv /tmp/githubcli-keyring.gpg "$keyring"
    $SUDO chmod go+r "$keyring"
    echo "deb [arch=$(dpkg --print-architecture) signed-by=$keyring] https://cli.github.com/packages stable main" \
      | $SUDO tee /etc/apt/sources.list.d/github-cli.list > /dev/null
  fi

  $SUDO apt-get update
  $SUDO apt-get install -y --no-install-recommends "${missing[@]}"
  $SUDO apt-get clean
  $SUDO rm -rf /var/lib/apt/lists/*
}

echo "Checking required CLI tooling (ffmpeg/ffprobe/gh/yt-dlp + python audio deps)..."
install_tooling_if_missing

echo "Installing dependencies with npm ci..."
npm ci

echo "Installing Playwright browsers and system dependencies..."
# Installs Chromium + WebKit binaries and the system libraries they need
# (apt packages: libgstreamer, libgtk-4, libgraphene, libwoff2dec, etc.)
npx playwright install --with-deps chromium webkit

echo "Running lightweight setup check (type-check)..."
npm run type-check

echo "Dev container setup complete."
