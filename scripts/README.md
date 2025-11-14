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

Creates a silent MP3 file for testing.

**Requirements:** ffmpeg must be installed

**Usage:**

```bash
./scripts/create-sample-audio.sh
```

**What it does:**

- Creates `public/audio/sample.mp3`
- 5 seconds of silence
- MP3 format for compatibility

---

### `generate-photo-hashes.js` - Generate Photo Hashes

Node.js script to generate dHash fingerprints for reference photos.

**Requirements:** Node.js and canvas package (installed via npm)

**Usage:**

```bash
npm run generate-hashes
# or directly:
node scripts/generate-photo-hashes.js
```

**What it does:**

- Reads images from `assets/test-images/`
- Computes dHash for each image
- Outputs photo hashes to console
- Use these hashes in `concerts.json` photoHash field

**Example output:**

```
Photo Hashes for assets/test-images/
concert-1.jpg: 00000000000001600acc000000000000
concert-2.jpg: 00000000000001200330000000000000
```

---

### `generate-photo-hashes.html` - Generate Photo Hashes (Browser)

Browser-based tool to generate dHash fingerprints for reference photos.

**Usage:**

1. Open `scripts/generate-photo-hashes.html` in a web browser
2. Click "Choose Files" and select image(s)
3. Copy the generated hash values
4. Add to `concerts.json` photoHash field

**What it does:**

- Uses same dHash algorithm as the app
- Processes images client-side in browser
- No server/Node.js required
- Useful for quick hash generation

---

### `generate-favicons.html` - Generate Favicon Images

Browser-based tool to generate PNG favicons from SVG.

**Usage:**

1. Open `scripts/generate-favicons.html` in a web browser
2. Click "Generate All Favicons"
3. Download each PNG file
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
- Exits with error code if limits exceeded
- Provides optimization suggestions on failure

**Example Output:**

```
📦 Bundle Size Analysis
JavaScript Bundle: 72 KB (gzipped) - ✅ PASS
CSS Bundle: 1 KB (gzipped) - ✅ PASS
Total Bundle: 73 KB
✅ All bundle size checks passed!
```

**Used by:** GitHub Actions CI workflow

---

### `copy-test-assets.sh` - Copy Test Assets

Manually copies test assets from `assets/` to `public/assets/`.

**Note:** This is normally done automatically by the Vite plugin during `npm run dev` or `npm run build`.

**Usage:**

```bash
./scripts/copy-test-assets.sh
```

**When to use:**

- Manual testing without running dev server
- Troubleshooting asset copying issues
- Preparing assets for deployment without Vite

**What it does:**

- Creates `public/assets/test-data/`, `test-audio/`, and `test-images/` directories
- Copies `concerts.json` from `assets/test-data/`
- Copies all MP3 files from `assets/test-audio/`
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

### `generate-photo-hashes.js` - Generate Photo Hashes

Generates dHash values for test images in `assets/test-images/`. These hashes are required for photo recognition to work in Test Mode.

**Requirements:** Node.js and npm packages installed

**Usage:**

```bash
# Using npm script (recommended)
npm run generate-hashes

# Or run directly
node scripts/generate-photo-hashes.js
```

**What it does:**

- Scans `assets/test-images/` directory for image files
- Computes dHash (Difference Hash) for each image
- Uses the same algorithm as the photo recognition module
- Outputs hashes in JSON format for easy copy-paste

**Example Output:**

```
📸 Photo Hash Generator

Found 4 image(s):

✓ concert-1.jpg
  Hash: 000000042a000000
  Size: 640 × 480 px

✓ concert-2.jpg
  Hash: 0000000416000000
  Size: 640 × 480 px

📋 JSON Output (for concerts.json):

[
  {
    "file": "concert-1.jpg",
    "photoHash": "000000042a000000"
  },
  ...
]
```

**When to use:**

- Adding new test images
- Regenerating hashes after image updates
- Verifying hash computation

**Browser Alternative:**

For a visual interface, open `scripts/generate-photo-hashes.html` in your browser and drag-and-drop images to generate hashes.

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

## Adding New Scripts

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
