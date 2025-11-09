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
