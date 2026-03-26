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

	if command -v sudo >/dev/null 2>&1; then
		sudo apt-get update
		sudo apt-get install -y --no-install-recommends "${missing[@]}"
		sudo apt-get clean
		sudo rm -rf /var/lib/apt/lists/*
	else
		apt-get update
		apt-get install -y --no-install-recommends "${missing[@]}"
		apt-get clean
		rm -rf /var/lib/apt/lists/*
	fi
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
