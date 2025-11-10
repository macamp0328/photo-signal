# Documentation Index

> **Purpose**: Central phonebook of all project documentation to help AI agents and developers quickly find information.

---

## 📚 Core Documentation

### Project Overview & Setup

- **[README.md](./README.md)** - Main project documentation, features, setup instructions, and usage
- **[SETUP.md](./SETUP.md)** - Detailed development environment setup, CI/CD, DevContainer, and Vercel deployment
- **[DOCKER.md](./DOCKER.md)** - Docker and Docker Compose setup, containerized development guide
- **[CONTRIBUTING.md](./CONTRIBUTING.md)** - Contribution guidelines, quality gates, AI agent PR policy, code style, testing requirements, and security guidelines

### Architecture & Design

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System architecture, module structure, data flow, and design principles
- **[AI_AGENT_GUIDE.md](./AI_AGENT_GUIDE.md)** - Examples of parallel AI agent development and collaboration patterns
- **[MIGRATION.md](./MIGRATION.md)** - Migration notes from old monolithic to new modular architecture
- **[TESTING.md](./TESTING.md)** - Testing strategy, framework recommendations, and coverage goals

### Project Planning & Roadmap

- **[ROADMAP.md](./ROADMAP.md)** - Complete project roadmap with 7 milestones and 60+ issues organized for AI agent development
- **[ISSUE_TRACKING.md](./ISSUE_TRACKING.md)** - Guide for creating, tracking, and managing GitHub Issues with templates and workflow recommendations

### Research & Technical Specifications

- **[docs/photo-recognition-research.md](./docs/photo-recognition-research.md)** - Comprehensive evaluation of photo recognition approaches (perceptual hashing, ML, cloud services) with technical recommendations
- **[docs/code-analysis-tooling-research.md](./docs/code-analysis-tooling-research.md)** - Research and evaluation of tracing, logging, and code analysis tools for AI agent development
- **[docs/code-analysis-tooling-guide.md](./docs/code-analysis-tooling-guide.md)** - Comprehensive guide to using and interpreting automated code analysis tools (CodeQL, Codecov, npm audit, etc.)
- **[docs/code-analysis-examples.md](./docs/code-analysis-examples.md)** - Real-world examples showing what each automated tool looks like when it runs
- **[docs/codecov-setup-guide.md](./docs/codecov-setup-guide.md)** - Step-by-step guide for setting up Codecov coverage tracking with screenshots and troubleshooting
- **[docs/codeql-setup-guide.md](./docs/codeql-setup-guide.md)** - Step-by-step guide for enabling CodeQL code scanning on private repositories with solutions for common issues

---

## 🧩 Module Documentation

Each module has its own README defining its API contract, usage, and examples.

### Core Modules (`src/modules/`)

- **[camera-access/README.md](./src/modules/camera-access/README.md)** - Camera permission and MediaStream management
- **[camera-view/README.md](./src/modules/camera-view/README.md)** - Video display UI component with 3:2 overlay
- **[motion-detection/README.md](./src/modules/motion-detection/README.md)** - Camera movement detection algorithm
- **[photo-recognition/README.md](./src/modules/photo-recognition/README.md)** - Photo matching using dHash perceptual hashing
  - **[photo-recognition/algorithms/dhash.ts](./src/modules/photo-recognition/algorithms/dhash.ts)** - dHash (Difference Hash) implementation
  - **[photo-recognition/algorithms/hamming.ts](./src/modules/photo-recognition/algorithms/hamming.ts)** - Hamming distance calculator
  - **[photo-recognition/algorithms/utils.ts](./src/modules/photo-recognition/algorithms/utils.ts)** - Image processing utilities
- **[audio-playback/README.md](./src/modules/audio-playback/README.md)** - Audio control, playback, and fading
- **[concert-info/README.md](./src/modules/concert-info/README.md)** - Concert information display overlay

### Services (`src/services/`)

- **[data-service/README.md](./src/services/data-service/README.md)** - Concert data loading and caching

---

## ⚙️ Configuration Files

### Build & Development

- **[package.json](./package.json)** - Dependencies, scripts, and project metadata
- **[vite.config.ts](./vite.config.ts)** - Vite build configuration
- **[vitest.config.ts](./vitest.config.ts)** - Vitest test configuration
- **[tsconfig.json](./tsconfig.json)** - TypeScript root configuration
- **[tsconfig.app.json](./tsconfig.app.json)** - TypeScript app-specific configuration
- **[tsconfig.node.json](./tsconfig.node.json)** - TypeScript Node.js configuration
- **[vercel.json](./vercel.json)** - Vercel deployment settings

### Testing

- **[src/test/setup.ts](./src/test/setup.ts)** - Vitest setup file with global test configuration
- **[src/test/mocks.ts](./src/test/mocks.ts)** - Global mocks for native browser APIs (MediaDevices, Canvas, Fetch, etc.)

#### Module Tests

- **[src/modules/camera-view/CameraView.test.tsx](./src/modules/camera-view/CameraView.test.tsx)** - Unit tests for camera-view component (100% coverage)
- **[src/modules/photo-recognition/algorithms/**tests**/dhash.test.ts](./src/modules/photo-recognition/algorithms/**tests**/dhash.test.ts)** - Unit tests for dHash algorithm (17 tests)
- **[src/modules/photo-recognition/algorithms/**tests**/hamming.test.ts](./src/modules/photo-recognition/algorithms/**tests**/hamming.test.ts)** - Unit tests for Hamming distance (20 tests)
- **[src/modules/photo-recognition/algorithms/**tests**/utils.test.ts](./src/modules/photo-recognition/algorithms/**tests**/utils.test.ts)** - Unit tests for image processing utilities (22 tests)

### Code Quality

- **[eslint.config.js](./eslint.config.js)** - ESLint linting rules (flat config format)
- **[.prettierrc.json](./.prettierrc.json)** - Prettier code formatting rules
- **[.prettierignore](./.prettierignore)** - Files excluded from Prettier formatting

### Styling

- **[tailwind.config.js](./tailwind.config.js)** - Tailwind CSS configuration
- **[postcss.config.js](./postcss.config.js)** - PostCSS configuration

---

## 🤖 GitHub & CI/CD

### Workflows

- **[.github/workflows/ci.yml](./.github/workflows/ci.yml)** - GitHub Actions CI pipeline (lint, format, type-check, test with coverage, build, bundle size check, npm audit)
- **[.github/workflows/pr-checks-monitor.yml](./.github/workflows/pr-checks-monitor.yml)** - Automated PR monitoring workflow that comments on PRs with failing checks and enforces AI agent compliance

### Actions

- **[.github/actions/setup-copilot/README.md](./.github/actions/setup-copilot/README.md)** - Composite action to pre-fetch GitHub Copilot documentation before firewall restrictions
- **[.github/actions/setup-copilot/action.yml](./.github/actions/setup-copilot/action.yml)** - Setup Copilot documentation cache action definition

### Templates & Instructions

- **[.github/pull_request_template.md](./.github/pull_request_template.md)** - Pull request template with quality gate checklist, AI agent responsibilities, and pre-merge requirements
- **[.github/copilot-instructions.md](./.github/copilot-instructions.md)** - Comprehensive GitHub Copilot agent instructions including code standards, error handling, accessibility, documentation standards, troubleshooting, git workflow, and dependency management
- **[.github/dependabot.yml](./.github/dependabot.yml)** - Dependabot configuration for automated dependency updates (npm and GitHub Actions)
- **[.github/ISSUE_TEMPLATE/\_TEMPLATE_GUIDE.md](./.github/ISSUE_TEMPLATE/_TEMPLATE_GUIDE.md)** - Guide for creating additional issue templates
- **[.github/ISSUE_TEMPLATE/module-level-tests.md](./.github/ISSUE_TEMPLATE/module-level-tests.md)** - Template for adding module tests (legacy)
- **[.github/ISSUE_TEMPLATE/firewall-gh-io-access.md](./.github/ISSUE_TEMPLATE/firewall-gh-io-access.md)** - Template for firewall configuration issue to allow Copilot agent access to gh.io domain

### Issue Templates (Milestone-based)

**Milestone 1: Testing Infrastructure**

- **[milestone-1-setup-testing-framework.md](./.github/ISSUE_TEMPLATE/milestone-1-setup-testing-framework.md)** - M1.1: Setup Vitest and React Testing Library
- **[milestone-1-test-camera-access.md](./.github/ISSUE_TEMPLATE/milestone-1-test-camera-access.md)** - M1.2: Test camera access module
- **[milestone-1-test-motion-detection.md](./.github/ISSUE_TEMPLATE/milestone-1-test-motion-detection.md)** - M1.3: Test motion detection module
- **[milestone-1-test-photo-recognition.md](./.github/ISSUE_TEMPLATE/milestone-1-test-photo-recognition.md)** - M1.4: Test photo recognition module
- **[milestone-1-test-audio-playback.md](./.github/ISSUE_TEMPLATE/milestone-1-test-audio-playback.md)** - M1.5: Test audio playback module
- **[milestone-1-test-camera-view.md](./.github/ISSUE_TEMPLATE/milestone-1-test-camera-view.md)** - M1.6: Test camera view component
- **[milestone-1-test-concert-info.md](./.github/ISSUE_TEMPLATE/milestone-1-test-concert-info.md)** - M1.7: Test concert info component
- **[milestone-1-test-data-service.md](./.github/ISSUE_TEMPLATE/milestone-1-test-data-service.md)** - M1.8: Test data service

**Milestone 2: Photo Recognition**

- **[milestone-2-research-photo-recognition.md](./.github/ISSUE_TEMPLATE/milestone-2-research-photo-recognition.md)** - M2.1: Research photo recognition approaches
- **[milestone-2-implement-hashing.md](./.github/ISSUE_TEMPLATE/milestone-2-implement-hashing.md)** - M2.2: Implement perceptual hashing

**Milestone 3: Audio Enhancements**

- **[milestone-3-audio-crossfade.md](./.github/ISSUE_TEMPLATE/milestone-3-audio-crossfade.md)** - M3.1: Implement audio crossfade

**Milestone 4: UX Enhancements**

- **[milestone-4-settings-panel.md](./.github/ISSUE_TEMPLATE/milestone-4-settings-panel.md)** - M4.1: Create user settings panel
- **[milestone-4-favorites-system.md](./.github/ISSUE_TEMPLATE/milestone-4-favorites-system.md)** - M4.2: Implement favorites system (parallel development example)

---

## 🛠️ Development Environment

### VS Code

- **[.vscode/settings.json](./.vscode/settings.json)** - VS Code workspace settings
- **[.vscode/extensions.json](./.vscode/extensions.json)** - Recommended VS Code extensions

### DevContainer

- **[.devcontainer/devcontainer.json](./.devcontainer/devcontainer.json)** - DevContainer configuration for consistent development environment

### Docker

- **[Dockerfile](./Dockerfile)** - Development Docker image configuration
- **[Dockerfile.prod](./Dockerfile.prod)** - Production Docker image with NGINX
- **[docker-compose.yml](./docker-compose.yml)** - Docker Compose orchestration for dev and prod
- **[nginx.conf](./nginx.conf)** - NGINX configuration for production container

### Helper Scripts

- **[scripts/README.md](./scripts/README.md)** - Documentation for all helper scripts
- **[scripts/dev.sh](./scripts/dev.sh)** - Start development server (local or Docker)
- **[scripts/build.sh](./scripts/build.sh)** - Build for production (local or Docker)
- **[scripts/test.sh](./scripts/test.sh)** - Run tests (local or Docker)
- **[scripts/lint.sh](./scripts/lint.sh)** - Run linting (local or Docker)
- **[scripts/format.sh](./scripts/format.sh)** - Format code (local or Docker)
- **[scripts/create-sample-audio.sh](./scripts/create-sample-audio.sh)** - Generate sample audio file
- **[scripts/check-bundle-size.sh](./scripts/check-bundle-size.sh)** - Check build bundle size against limits (used in CI)

---

## 📦 Data & Assets

### Production Data

- **[public/data.json](./public/data.json)** - Concert metadata (band, venue, date, audio file)
- **[public/audio/README.md](./public/audio/README.md)** - Audio files directory and instructions

### Test Assets (CC0 Licensed)

- **[ASSET_LICENSES.md](./ASSET_LICENSES.md)** - Licensing information and attribution for all test assets
- **[assets/test-images/README.md](./assets/test-images/README.md)** - Sample JPEG images for testing (4 files, ~30KB each)
- **[assets/test-audio/README.md](./assets/test-audio/README.md)** - Sample MP3 audio files for testing (4 files, ~40KB each, 5 seconds)
- **[assets/test-data/README.md](./assets/test-data/README.md)** - Sample structured data files (JSON, CSV formats)

---

## 🔍 Quick Reference

### For Adding New Features

1. Check **ARCHITECTURE.md** for system design and module structure
2. Read relevant module README for API contract
3. Review **AI_AGENT_GUIDE.md** for parallel development patterns
4. Follow code quality standards in **SETUP.md**

### For Configuration Changes

1. **Dependencies**: Update `package.json`
2. **Build settings**: Update `vite.config.ts` or `tsconfig.json`
3. **Code style**: Update `eslint.config.js` or `.prettierrc.json`
4. **CI/CD**: Update `.github/workflows/ci.yml`

### For AI Agents

- **New module**: Read ARCHITECTURE.md, create module with README.md first
- **Modify module**: Read module's README.md for contract, keep changes isolated
- **Parallel work**: See AI_AGENT_GUIDE.md for conflict-free collaboration
- **Testing**: See TESTING.md for strategy (tests not yet implemented)

---

## 📝 Maintenance

### When Adding New Documentation

1. Create the new documentation file
2. **Update this DOCUMENTATION_INDEX.md** with a link and description
3. Add appropriate category if needed
4. Commit both files together

### When Removing Documentation

1. Delete the documentation file
2. **Remove the link from this DOCUMENTATION_INDEX.md**
3. Check for any references in other docs
4. Commit changes together

### When Reorganizing

1. Move files to new locations
2. **Update all links in this DOCUMENTATION_INDEX.md**
3. Update any cross-references in other documentation
4. Test all links still work

---

## 🎯 Documentation Coverage

This index covers:

- ✅ Root documentation (10 files - added CONTRIBUTING.md)
- ✅ Research & technical specifications (6 files - including CodeQL and Codecov setup guides)
- ✅ Module READMEs (7 files)
- ✅ Photo recognition algorithms (3 files)
- ✅ Configuration files (14 files)
- ✅ GitHub Actions & workflows (3 files - CI workflow, PR checks monitor, and Dependabot config)
- ✅ GitHub Actions - custom actions (2 files)
- ✅ GitHub templates (1 file - PR template)
- ✅ Issue templates (17 files - includes template guide and firewall access template)
- ✅ Development environment configs (3 files)
- ✅ Docker configuration (4 files)
- ✅ Helper scripts (8 files including README and bundle size checker)
- ✅ Data and asset documentation (6 files - added ASSET_LICENSES.md and 3 asset READMEs)
- ✅ Test infrastructure (2 files)
- ✅ Module tests (4 files)

**Total**: 83 documented files

Last updated: 2025-11-10
