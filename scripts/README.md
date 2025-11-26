# Helper Scripts

This directory contains helper scripts for common development tasks. All scripts work with both local npm and Docker environments.

## Usage

### Environment Variable

Set `USE_DOCKER=true` to run commands in Docker containers instead of locally:

```bash
# Run locally (default)
./scripts/dev.sh

# Run in Docker
USE_DOCKER=true ./scripts/dev.sh
```

## Audio Workflow Directory

The download -> organize -> encode -> update workflow now lives under `scripts/audio-workflow/`. Use the dedicated [audio-workflow/README.md](./audio-workflow/README.md) for a stage-by-stage overview plus future plans for the organize and encode steps. CLI shortcuts (`npm run download-song`, `npm run migrate-audio`, `npm run validate-audio`) still invoke the scripts in this directory directly.

## Available Scripts

### `dev.sh` - Development Server

Starts the Vite development server.

**Local:**

```bash
./scripts/dev.sh
```

**Docker:**

```bash
USE_DOCKER=true ./scripts/dev.sh
```

**What it does:**

- Starts Vite dev server on port 5173
- Enables hot module replacement
- Opens the app for development

---

### `build.sh` - Build for Production

Builds the application for production deployment.

**Local:**

```bash
./scripts/build.sh
```

**Docker:**

```bash
USE_DOCKER=true ./scripts/build.sh
```

**What it does:**

- Compiles TypeScript
- Bundles with Vite
- Outputs to `dist/` directory

---

### `test.sh` - Run Tests

Runs all tests using Vitest.

**Local:**

```bash
./scripts/test.sh
```

**Docker:**

```bash
USE_DOCKER=true ./scripts/test.sh
```

**What it does:**

- Runs all test files (`*.test.tsx`)
- Outputs test results
- Exits with error code if tests fail

---

### `lint.sh` - Lint Code

Checks code quality with ESLint.

**Local:**

```bash
# Check only
./scripts/lint.sh

# Auto-fix issues
./scripts/lint.sh --fix
```

**Docker:**

```bash
# Check only
USE_DOCKER=true ./scripts/lint.sh

# Auto-fix issues
USE_DOCKER=true ./scripts/lint.sh --fix
```

**What it does:**

- Runs ESLint on all source files
- Reports linting errors
- Optionally fixes auto-fixable issues

---

### `format.sh` - Format Code

Formats code with Prettier.

**Local:**

```bash
# Format all files
./scripts/format.sh

# Check formatting only
./scripts/format.sh --check
```

**Docker:**

```bash
# Format all files
USE_DOCKER=true ./scripts/format.sh

# Check formatting only
USE_DOCKER=true ./scripts/format.sh --check
```

**What it does:**

- Formats all files according to `.prettierrc.json`
- Can check formatting without modifying files
- Ensures consistent code style

---

### `create-sample-audio.sh` - Generate Sample Audio

Creates a silent Opus file for testing.

**Requirements:** ffmpeg must be installed

**Usage:**

```bash
./scripts/create-sample-audio.sh
```

**What it does:**

- Creates `public/audio/sample.opus`
- 5 seconds of silence
- Opus format for superior quality and compression

---

### `audio-workflow/download/download-yt-song.js` - Download One Track with yt-dlp

Downloads audio from YouTube Music playlists (or direct track URLs) using [`yt-dlp`](https://github.com/yt-dlp/yt-dlp) with duplicate protection, metadata capture, gentle throttling, and authenticated session support. By default it grabs the best native Opus stream; if Opus is unavailable it automatically retries and falls back to MP3 conversion (configurable via `--format` or `--format-order`).

**Requirements:** `yt-dlp` and `ffmpeg`. They are now baked into the dev container/Docker image. When running on your host machine, install them via Homebrew/winget (`brew install ffmpeg`, `pip install -U yt-dlp`).

**Common usage:**

```bash
# Download the first track from the default Photo Signal playlist
npm run download-song -- --item 1 --output-dir ~/Music/photo-signal

# Download a specific playlist item from a custom playlist
npm run download-song -- --playlist-url "<playlist-url>" --item 5

# Download by direct track URL (skips playlist indexing)
npm run download-song -- --track-url "https://music.youtube.com/watch?v=..."

# Force a specific YouTube player client (android now requires a PO token)
npm run download-song -- --item 1 --player-client android --po-token "android.gvs+XXXX"

# Use authenticated cookies and throttle to 3 MB/s for long sessions
npm run download-song -- \
  --cookies-from-browser chrome \
  --rate-limit 3M \
  --item 12

# Dry-run to inspect the underlying yt-dlp command
npm run download-song -- --item 1 --dry-run

# Force MP3 output only
npm run download-song -- --format mp3

# Provide a custom priority order (Opus → WAV → MP3)
npm run download-song -- --format-order opus,wav,mp3
```

> Tip: Omit `--item` (or pass `--item all`) to download the entire playlist once you're satisfied with your metadata output.

The downloader now defaults to the `webremix` client because YouTube's android and tv clients require a signed PO token. If you explicitly pick one of those clients, pass `--po-token` (or set it in your config file). Without the token yt-dlp will skip most HTTPS formats due to 403 responses.

**What it does:**

- Creates the output directory if it does not exist (default: `downloads/yt-music`)
- Extracts audio with ffmpeg (or keeps the original container via `--keep-video`)
- Prefers `.opus` output automatically and retries with `.mp3` if Opus is missing (pass `--format` or `--format-order` to override the priority list)
- Adds `--download-archive` automatically so you never pull the same track twice
- Auto-detects the Node.js runtime that launched the script and forwards it to yt-dlp via `--js-runtimes` so the modern `webremix` client keeps working (pass `--js-runtime` or `--no-js-runtime` for manual control)
- Applies gentle throttling (`--sleep-requests 0.5`, configurable) plus higher retry counts to avoid HTTP 429/403 responses
- Supports authenticated sessions via `--cookies-from-browser`, `--cookies`, `--netrc`, and `--proxy`
- Provides `--update-yt-dlp`, `--yt-dlp-path`, `--skip-prereq-check`, and `--dry-run` for advanced workflows
- Generates a machine-readable `*.metadata.json` file for every downloaded song that captures playlist info, YouTube metadata (`.info.json` contents), chosen audio format, and filesystem paths for downstream photo-to-song alignment

> Tip: `downloads/` is already in `.gitignore` so large audio files never end up in git—feel free to use subfolders inside it.

**Persistent defaults:**

- Copy `scripts/audio-workflow/download/download-yt-song.config.example.json` to `scripts/audio-workflow/download/download-yt-song.config.json` (a ready-made config is already checked in for the Photo Signal playlist and `../downloads` output folder - adjust paths if your machine needs different locations) and edit the values to store your playlist URL, preferred output path, archive location, throttling values, and format priority (e.g., `"format-order": "opus,mp3"`).
- The script auto-loads `scripts/audio-workflow/download/download-yt-song.config.json` on every run; CLI flags always win if you need a temporary override.

**Advanced example:**

```bash
npm run download-song -- \
  --playlist-url "https://music.youtube.com/playlist?list=..." \
  --item 27 \
  --output-dir ~/Music/photo-signal/raw \
  --rate-limit 2.5M \
  --sleep-requests 1 \
  --cookies-from-browser firefox \
  --download-archive ~/Music/photo-signal/.archive.txt \
  --metadata --write-info-json
```

**Metadata index files:**

- Every successful download drops `Track.ext.metadata.json` next to the audio file.
- Each index merges playlist context, yt-dlp's `.info.json` payload, detected codec/bitrate, filesystem paths, download-archive identifiers, and the timestamp the file landed on disk.
- Disable this behavior with `--no-index` (or set `"write-index": false` inside your config) when you need a minimal download-only session.

---

### `audio-workflow/encode/encode-audio.js` - Encode and Normalize Audio

Converts downloaded audio files into production-ready Opus format with loudness normalization, metadata tagging, and manifest generation. Implements the complete encoding pipeline described in `scripts/audio-workflow/encode/README.md`.

**Requirements:** `ffmpeg` (with libopus support) and `ffprobe`. Already included in the dev container. For local development, install via Homebrew/apt (`brew install ffmpeg`, `apt install ffmpeg`).

**Common usage:**

```bash
# Encode all downloads in the default directory
npm run encode-audio

# Encode with custom input directory
npm run encode-audio -- --input-dir ~/Music/downloads

# Preview what would be encoded (dry run)
npm run encode-audio -- --dry-run

# Custom output directory
npm run encode-audio -- --output-dir ~/Music/encoded

# Show all options
npm run encode-audio -- --help
```

**What it does:**

- Scans the download output directory for `.metadata.json` files
- Converts source audio to 48kHz stereo WAV
- Measures loudness using two-pass EBU R128 analysis
- Normalizes to target LUFS (-14.0 by default) with true peak limiting
- Applies configurable fade-in/fade-out effects
- Encodes to Opus format (160 kbps, complexity 10 by default)
- Tags metadata: artist, title, album, date, venue, copyright, website
- Calculates SHA256 checksums for file integrity
- Generates manifests:
  - `audio-index.json` - Machine-readable track index with LUFS stats
  - `photo-audio-map.json` - Photo-to-audio mapping (placeholder for future photo integration)
  - `encode-report.md` - Human-readable summary with quality checklist

**Configuration:**

Edit `scripts/audio-workflow/encode/encode.config.json` to customize:

```json
{
  "targetLUFS": -14,
  "truePeakLimit": -1.5,
  "lraTarget": 11,
  "opus": {
    "bitrateKbps": 160,
    "complexity": 10,
    "frameSizeMs": 20
  },
  "fades": {
    "fadeInSeconds": 0.5,
    "fadeOutSeconds": 1.0
  },
  "metadataDefaults": {
    "album": "Photo Signal Playlist",
    "genre": "Live Recording",
    "copyright": "Photo Signal",
    "website": "https://photosignal.app"
  }
}
```

**Output files:**

```
scripts/audio-workflow/encode/output/
├── ps-20230815-the-midnight-echoes-the-fillmore.opus
├── ps-20230922-electric-dreams-red-rocks-amphitheatre.opus
├── audio-index.json          # Track index with LUFS, duration, checksums
├── photo-audio-map.json      # Photo-to-audio mapping (placeholder)
└── encode-report.md          # Human-readable summary
```

**Workflow integration:**

```bash
# 1. Download audio
npm run download-song -- --item 1

# 2. Encode downloaded audio
npm run encode-audio

# 3. Upload to CDN (future)
# npm run upload-audio

# 4. Validate URLs
npm run validate-audio
```

See the [encode README](./audio-workflow/encode/README.md) for complete documentation, configuration details, and troubleshooting.

---

### `audio-workflow/update/upload-to-r2.js` - Upload Encoded Assets to Cloudflare R2

Ships the Stage 2 output (Opus files, manifests, metadata) to Cloudflare R2 using the S3-compatible API.

**Usage:**

```bash
# Upload everything under scripts/audio-workflow/encode/output
npm run upload-audio -- --skip-existing

# Same command but auto-load .env.local first
npm run upload-audio:local -- --skip-existing

# Override the destination prefix and run in dry-run mode
npm run upload-audio -- --prefix staging/audio --dry-run

# Point at a custom input directory
npm run upload-audio -- --input-dir ./output --include-ext .opus,.json
```

**Environment variables:**

- Copy `.env.example` to `.env.local` (ignored by git) and set the secrets there, or export them manually before running the script.

- `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` (required) – issued from your Cloudflare R2 account
- `R2_ENDPOINT` **or** `R2_ACCOUNT_ID` – endpoint base URL (`https://<account>.r2.cloudflarestorage.com`)
- `R2_BUCKET_NAME` – defaults to `photo-signal-audio`
- `R2_PREFIX` – optional folder-style prefix (e.g., `prod/audio`)
- `R2_BASE_URL` – public URL root for summary output (`https://.../photo-signal-audio`)
- `R2_INPUT_DIR`, `R2_INCLUDE_EXTENSIONS`, `R2_CONCURRENCY`, `R2_SKIP_EXISTING`, `R2_DRY_RUN` – override defaults without CLI flags

**What it does:**

- Discovers `.opus`, `.json`, and `.md` files under the chosen directory
- Computes SHA-256 checksums and records them as R2 object metadata
- Applies immutable cache headers for audio and short-lived caching for manifests
- Offers `--skip-existing` to HEAD-check remote objects using stored hashes/size before uploading
- Prints a deployment summary plus CDN-ready URLs for newly uploaded assets

See the [audio workflow README](./audio-workflow/README.md#stage-3-update-ready) for additional context and usage tips.

---

### `update-recognition-data.js --paths-mode` - Generate Photo Hashes

`npm run generate-hashes` now routes through the unified recognition CLI. Passing `--paths-mode` turns `scripts/update-recognition-data.js` into a lightweight hash generator for arbitrary files or folders, so you get the same multi-exposure fingerprints without touching the concert dataset.

**Requirements:** Node.js and the existing project dependencies (no extra scripts required)

**Usage:**

```bash
# Recommended npm alias
npm run generate-hashes -- --paths assets/example-real-photos

# Direct invocation with custom flags
node scripts/update-recognition-data.js \
  --paths-mode \
  --paths assets/test-images/,assets/example-real-photos \
  --algorithms phash,dhash

# Single file shortcut
node scripts/update-recognition-data.js --paths-mode --path assets/test-images/concert-1.jpg
```

**What it does:**

- Accepts any mix of files or directories (defaults to `assets/test-images/`)
- Generates three exposure-adjusted hashes (dark, normal, bright) per algorithm
- Supports both dHash and pHash (`--algorithms dhash`, `--algorithms phash`, or both)
- Prints human-friendly output plus ready-to-paste JSON payloads for `photoHashes`
- Skips ORB/public sync automatically so it runs fast and read-only

**Example output:**

```
📸 Photo Signal recognition data updater — paths mode
Algorithms: phash, dhash
Targets:
  • assets/test-images/concert-1.jpg
  • assets/test-images/concert-2.jpg
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Found 2 image(s):

✓ assets/test-images/concert-1.jpg
  PHASH (dark):   9853660d98d36f26
  PHASH (normal): 98d2662d98d26f26
  PHASH (bright): 98f2662c98d26f26
  DHASH (dark):   3e1f0c0d3e1f0c0d
  DHASH (normal): 3e1f0c0d3e1f0c0c
  DHASH (bright): 3e1f0c0d3e1f0c0b
  Size: 640 × 480 px

📋 JSON Output (merge into concerts data):
[
  {
    "file": "assets/test-images/concert-1.jpg",
    "photoHashes": {
      "phash": [
        "9853660d98d36f26",
        "98d2662d98d26f26",
        "98f2662c98d26f26"
      ],
      "dhash": [
        "3e1f0c0d3e1f0c0d",
        "3e1f0c0d3e1f0c0c",
        "3e1f0c0d3e1f0c0b"
      ]
    }
  }
]
```

**Next steps after generation**:

1. Merge the JSON block into the relevant concert entries (`imageFile` must match `file`).
2. Regenerate both algorithms if you rely on dual-hash matching.
3. Commit the updated data files once verified.

---

### `update-recognition-data.js` - Refresh Hashes & ORB Payloads

Single entry point for keeping every concert's recognition metadata current. It can regenerate multi-exposure dHash/pHash values, rebuild ORB feature payloads, or do both in one run.

**Usage:**

```bash
# Full refresh (hashes + ORB + public sync)
npm run update-recognition-data

# Hashes only (compat alias)
npm run rebuild-hashes

# ORB only (compat alias)
npm run generate-orb-features

# Targeted update examples
npm run update-recognition-data -- \
  --ids 6,7 \
  --hashes-only \
  --algorithms phash \
  --skip-public \
  --dry-run

npm run update-recognition-data -- \
  --orb-only \
  --max-features 1200 \
  --fast-threshold 10
```

**Highlights:**

- Reads from `assets/test-data/concerts.dev.json` (override via `--input`)
- Writes refreshed data back to the source file unless `--dry-run`
- Mirrors updated entries into `public/data.json` unless `--skip-public`
- Regenerates dHash and pHash (three exposure variants each)
- Rebuilds serialized ORB payloads using the optimized defaults (max 1000 features, fast threshold 12, match ratio 0.75)
- Supports targeted runs via `--id` / `--ids`
- Offers granular toggles: `--hashes-only`, `--orb-only`, `--no-hashes`, `--no-orb`
- Includes a fast `--paths-mode` for ad-hoc hash generation (used by `npm run generate-hashes`)
- Accepts ORB tuning flags (`--max-features`, `--fast-threshold`, `--scale-factor`, `--edge-threshold`, `--match-ratio-threshold`, `--min-match-count`)
- Provides a safe `--dry-run` preview before writing any files

Lean on this script whenever reference photos change, recognition parameters shift, or the two concert data files need to be re-synchronized.

### `create-easy-test-images.js` - Generate High-Contrast Targets

Creates bold, high-contrast PNG images that are easy for the recognition system to match.

**Local:**

```bash
npm run create-easy-images
```

**What it does:**

- Generates three 640×480 PNG files in `assets/test-images/`
- Designs include a bullseye, diagonal stripes, and checkerboard grid
- Ensures repeatable assets for troubleshooting recognition accuracy
- Safe to re-run at any time (files will be overwritten)

Use these assets when you need ultra-distinct patterns for calibration or debugging.

---

### `create-photo-csv.js` - Bootstrap Production Photo Catalogs

Scans `assets/prod-photographs/` (override via `--input`) and emits a starter CSV that matches the `concerts.csv` schema plus camera metadata. Every `.jpg` becomes a new row with the `imageFile` column pre-filled and EXIF details pulled from the source file so you can fill in artist/venue details manually in Excel.

**Usage:**

```bash
# Default input/output
node scripts/create-photo-csv.js

# Custom paths
node scripts/create-photo-csv.js \
  --input=assets/prod-photographs \
  --output=assets/test-data/prod-photographs.csv \
  --imageBasePath=/assets/prod-photographs
```

- **What it does:**

- Writes `assets/test-data/prod-photographs.csv` (configurable) with headers:
  `id, band, venue, date, audioFile, imageFile, shutterSpeed, camera, aperture, focalLength, iso`
- Auto-increments `id` based on alphabetical filename ordering so spreadsheets stay stable between runs
- Prefills `imageFile` using the provided `--imageBasePath` so downstream tooling already references the final public path
- Extracts EXIF fields using [`exifr`](https://github.com/MikeKovarik/exifr):
  - `date` → Central Time ISO timestamp (DateTimeOriginal converted to America/Chicago, e.g., `2025-03-15T19:39:37-05:00`)
  - `shutterSpeed` → Formatted exposure (e.g., `1/125`)
  - `camera` → Combined make + model string
  - `aperture` → `f/<number>` notation
  - `focalLength` → Native focal length plus 35mm equivalent when available (e.g., `17.0mm 34mm eq`)
  - `iso` → Numeric ISO sensitivity value
- Leaves band/venue/date/audio columns blank for manual curation

Re-run the script whenever new production photos are added—existing CSV rows will be replaced, so keep curated copies (`prod-photographs.v1.csv`, etc.) when you need version history.

---

### `generate-photo-hashes.html` - Generate Photo Hashes (Browser)

Browser-based tool to generate dHash fingerprints for reference photos.

**Usage:**

1. Open `scripts/generate-photo-hashes.html` in a web browser
2. Click "Choose Files" and select image(s)
3. Copy the generated hash values
4. Drop the output directly into `photoHashes.dhash` (JSON already matches the schema)

**What it does:**

- Uses same dHash algorithm as the app
- Processes images client-side in browser
- No server/Node.js required
- Useful for quick hash generation
- JSON output already conforms to the `photoHashes` schema (dHash key only)

4. Place in `public/` directory

**What it does:**

- Converts `public/favicon.svg` to PNG at various sizes
- Generates 16×16, 32×32, 180×180, 192×192, 512×512 px PNGs
- Client-side generation (no server required)

See [public/README.md](../public/README.md) for more details.

---

### `check-bundle-size.sh` - Check Bundle Size

Monitors production bundle sizes and enforces size limits (used in CI).

**Requirements:** Build must be completed first (`npm run build`)

**Usage:**

```bash
./scripts/check-bundle-size.sh
```

**What it does:**

- Analyzes files in `dist/assets/`
- Checks JavaScript bundle (limit: 80 KB gzipped)
- Checks CSS bundle (limit: 3 KB gzipped)
  Total Bundle: 73 KB
  ✅ All bundle size checks passed!

````

**Used by:** GitHub Actions CI workflow


```bash
./scripts/copy-test-assets.sh
````

**When to use:**

- Manual testing without running dev server
- Troubleshooting asset copying issues
- Preparing assets for deployment without Vite

**What it does:**

- Creates `public/assets/test-data/`, `test-audio/`, and `test-images/` directories
- Copies `concerts.json` from `assets/test-data/`
- Copies all Opus audio files from `assets/test-audio/`
- Copies all JPG files from `assets/test-images/`

**Normal workflow:**

Just run `npm run dev` or `npm run build` - the Vite plugin handles this automatically.

## Script Features

### ✅ Cross-Platform

- Work on Mac, Linux, and Windows (WSL)
- Bash scripts for maximum compatibility

### 🐳 Docker Support

- Single environment variable switches between local and Docker
- No need to remember different commands

### 🎯 Consistent Interface

- All scripts follow the same pattern
- Optional flags for additional functionality

### 🚀 Quick & Easy

- Executable by default (chmod +x already applied)
- Clear output messages
- Error handling included

## Examples

### Complete Development Workflow

```bash
# 1. Format code
./scripts/format.sh

# 2. Lint and fix issues
./scripts/lint.sh --fix

# 3. Run tests
./scripts/test.sh

# 4. Build for production
./scripts/build.sh
```

### Using Docker Throughout

```bash
# Set environment variable once
export USE_DOCKER=true

# Run all commands with Docker
./scripts/test.sh
./scripts/lint.sh
./scripts/build.sh
./scripts/dev.sh
```

### CI/CD Simulation

```bash
# Run the same checks as GitHub Actions
./scripts/lint.sh
./scripts/format.sh --check
./scripts/test.sh
./scripts/build.sh
```

## Troubleshooting

### Permission Denied

If you get "Permission denied" errors:

```bash
chmod +x scripts/*.sh
```

### Docker Not Found

If Docker is not installed:

```bash
# Install Docker Desktop (Mac/Windows)
# https://www.docker.com/products/docker-desktop

# Or install Docker Engine (Linux)
# https://docs.docker.com/engine/install/
```

### Scripts Don't Work on Windows

Use WSL (Windows Subsystem for Linux):

```bash
# In PowerShell (as Administrator)
wsl --install

# Then run scripts from WSL terminal
./scripts/dev.sh
```

## Integration

These scripts are used by:

- **VS Code Tasks** - Can be configured in `.vscode/tasks.json`
- **Git Hooks** - Can be added to `.git/hooks/`
- **CI/CD** - GitHub Actions uses npm commands directly
- **Documentation** - Referenced in README.md and SETUP.md

---

### `npm run generate-hashes` - Quick Reference

The legacy `generate-photo-hashes.js` script has been folded into `update-recognition-data.js`. Use the existing npm alias to generate hashes without remembering the full flag list.

```bash
# Default: hash everything under assets/test-images/
npm run generate-hashes

# Point to additional folders or files
npm run generate-hashes -- --paths assets/example-real-photos,new-shots.jpg

# Switch algorithms
npm run generate-hashes -- --algorithms phash
```

Behind the scenes this runs `node scripts/update-recognition-data.js --paths-mode ...`, which prints per-image details and a ready-to-paste JSON block exactly like the full CLI. Re-run with different `--algorithms` values (or leave defaults for both dHash + pHash) whenever you update photos used by Test Mode.

**Browser alternative:** if you prefer a drag-and-drop UI, open `scripts/generate-photo-hashes.html` for the same dHash workflow entirely in the browser.

---

### `audio-workflow/update/migrate-audio-to-cdn.js` - Migrate Audio to CDN

Migrates audio files to a CDN (GitHub Releases or Cloudflare R2) and updates `data.json` with the new URLs while preserving local fallbacks.

**Requirements:** Node.js (ES modules support)

**Usage:**

```bash
# Using npm script (recommended)
npm run migrate-audio -- [options]

# Or run directly
node scripts/audio-workflow/update/migrate-audio-to-cdn.js [options]
```

**Options:**

- `--source=<path>` - Path to data.json (default: `public/data.json`)
- `--cdn=<provider>` - CDN provider: `github-release` | `r2` (default: `github-release`)
- `--base-url=<url>` - Base URL for CDN files (required)
- `--dry-run` - Preview changes without writing files
- `--help` - Show help message

**What it does:**

- Updates `audioFile` field with CDN URLs
- Adds `audioFileFallback` field with local paths
- Sets `audioFileSource` field to indicate CDN provider
- Creates backup of original data.json
- Provides detailed migration summary

**Example Output:**

```
🎵 Audio CDN Migration Script

Configuration:
  Source: public/data.json
  CDN Provider: github-release
  Base URL: https://github.com/user/repo/releases/download/audio-v1
  Dry Run: No

✓ Concert #1 (The Midnight Echoes):
    Original: /audio/concert-1.opus
    CDN URL:  https://github.com/.../concert-1.opus
    Fallback: /audio/concert-1.opus

📊 Migration Summary:
  Migrated: 12 concerts
  Skipped:  0 concerts
  Total:    12 concerts

✅ Updated data.json: public/data.json
```

**Examples:**

```bash
# Dry run first (preview changes)
npm run migrate-audio -- --dry-run --base-url=https://github.com/user/repo/releases/download/audio-v1

# Migrate to GitHub Releases
npm run migrate-audio -- --base-url=https://github.com/user/repo/releases/download/audio-v1

# Migrate to Cloudflare R2
npm run migrate-audio -- --cdn=r2 --base-url=https://audio.example.com
```

**When to use:**

- Setting up CDN delivery for production
- Migrating from local files to CDN
- Updating CDN URLs after changing providers

**See also:** [docs/audio-streaming-setup.md](../docs/audio-streaming-setup.md) - Complete audio streaming guide

---

### `audio-workflow/update/validate-audio-urls.js` - Validate Audio URLs

Validates that all audio URLs in `data.json` are accessible and reports any broken links or issues.

**Requirements:** Node.js (ES modules support)

**Usage:**

```bash
# Using npm script (recommended)
npm run validate-audio -- [options]

# Or run directly
node scripts/audio-workflow/update/validate-audio-urls.js [options]
```

**Options:**

- `--source=<path>` - Path to data.json (default: `public/data.json`)
- `--timeout=<ms>` - Request timeout in milliseconds (default: 10000)
- `--check-fallback` - Also check fallback URLs
- `--help` - Show help message

**What it does:**

- Checks accessibility of primary audio URLs
- Optionally checks fallback URLs
- Supports both local files and remote URLs
- Reports success rate and failed URLs
- Provides troubleshooting recommendations

**Example Output:**

```
🎵 Audio URL Validation Script

Configuration:
  Source: public/data.json
  Timeout: 10000ms
  Check Fallback: No

Checking Concert #1: The Midnight Echoes
  ✓ Primary:  /audio/concert-1.opus
            Status: 200 OK (local file)

📊 Validation Summary:
  Total URLs Checked: 12
  Successful: 12 (100.0%)
  Failed:     0

✅ All audio URLs are accessible!
```

**Examples:**

```bash
# Validate production data.json
npm run validate-audio

# Validate with fallback URLs
npm run validate-audio -- --check-fallback

# Validate test data
npm run validate-audio -- --source=assets/test-data/concerts.json
```

**When to use:**

- After migrating to CDN
- Before deploying to production
- Debugging audio playback issues
- Verifying CDN configuration

**See also:** [docs/audio-streaming-setup.md](../docs/audio-streaming-setup.md) - Complete audio streaming guide

---

### `generate-favicons.html` - Generate Favicon Images

Browser-based tool to generate all required favicon PNG files from the camera icon design.

**Requirements:** Modern web browser (Chrome, Firefox, Safari, Edge)

**Usage:**

```bash
# Open in browser (from project root)
open scripts/generate-favicons.html
# or
xdg-open scripts/generate-favicons.html  # Linux
# or just double-click the file
```

**What it does:**

- Generates PNG favicons in multiple sizes:
  - `favicon-16x16.png` (16×16 px)
  - `favicon-32x32.png` (32×32 px)
  - `apple-touch-icon.png` (180×180 px)
  - `android-chrome-192x192.png` (192×192 px)
  - `android-chrome-512x512.png` (512×512 px)
- Provides download buttons for each size
- Shows live previews of all generated icons

**Steps:**

1. Open `scripts/generate-favicons.html` in your browser
2. Click "Generate All Favicons"
3. Download each PNG file using the "Download" button or right-click → Save Image As
4. Place all downloaded files in `public/` directory
5. Verify filenames match exactly (e.g., `favicon-16x16.png`)

**When to use:**

- Setting up the project for the first time
- Updating the favicon design
- Regenerating favicon files after design changes

---

### `cleanup-docs.js` - Clean Up Documentation Files

Removes historical and redundant documentation files that don't provide ongoing value.

**Requirements:** Node.js (ES modules support)

**Usage:**

```bash
# Using npm script (recommended)
npm run cleanup-docs

# Or run directly
node scripts/cleanup-docs.js
```

**What it does:**

- Deletes 21 historical/completed work documentation files:
  - Root-level workflow analysis docs (PR #162 historical record)
  - Completed implementation summaries
  - Research documents consolidated into FUTURE_FEATURES.md
  - Redundant setup guides
- Preserves all essential documentation (README, ARCHITECTURE, CONTRIBUTING, etc.)
- Provides detailed summary of deletions
- Exits with error code if any deletions fail

**Files Removed:**

Root Level:

- `CLEANUP_EXECUTIVE_SUMMARY.md`
- `README_ANALYSIS_COMPLETE.md`
- `WORKFLOW_COMPARISON_TABLE.md`
- `WORKFLOW_SPAM_EXAMPLES.md`
- `AUTO_FIX_WORKFLOW.md`
- `MOBILE_UX_IMPROVEMENTS.md`
- `FAVICON_SETUP.md`

Docs Directory:

- `docs/test-mode-fix-summary.md`
- `docs/grayscale-feature-implementation.md`
- `docs/mobile-first-refactor-summary.md`
- `docs/phase-1-implementation-verification.md`
- `docs/IMPLEMENTATION_STATUS_SUMMARY.md`
- `docs/phase-2-angle-compensation-analysis.md`
- `docs/phase-2-benchmarking-guide.md`
- `docs/phase-2-migration-guide.md`
- `docs/opus-streaming-implementation-plan.md`
- `docs/audio-streaming-setup.md`
- `docs/code-analysis-examples.md`
- `docs/code-analysis-tooling-research.md`
- `docs/image-recognition-exploratory-analysis.md`

**When to use:**

- Initial repository setup to remove bloat
- After reviewing PR discussion about documentation cleanup
- When AI agents have created too many historical docs

**See also:** [FUTURE_FEATURES.md](../FUTURE_FEATURES.md) - Consolidated list of unimplemented features

---

To add a new helper script:

1. Create the script in `scripts/` directory
2. Add shebang: `#!/bin/bash`
3. Set executable permission: `chmod +x scripts/new-script.sh`
4. Follow the pattern of existing scripts
5. Support `USE_DOCKER` environment variable
6. Update this README with documentation
7. Update DOCUMENTATION_INDEX.md

## See Also

- [DOCKER.md](../DOCKER.md) - Complete Docker documentation
- [SETUP.md](../SETUP.md) - Development environment setup
- [README.md](../README.md) - Project overview
