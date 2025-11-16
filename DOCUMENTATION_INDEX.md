# Documentation Index

> **Purpose**: Central phonebook of all project documentation to help AI agents and developers quickly find information.

---

## 📚 Core Documentation

### Project Overview & Setup

- **[README.md](./README.md)** - Main project documentation, features, setup instructions, and usage
- **[SETUP.md](./SETUP.md)** - Detailed development environment setup, CI/CD, DevContainer, Vercel deployment, and Playwright visual test setup
- **[DOCKER.md](./DOCKER.md)** - Docker and Docker Compose setup, containerized development guide
- **[CONTRIBUTING.md](./CONTRIBUTING.md)** - Contribution guidelines, quality gates, AI agent PR policy, code style, testing requirements, and security guidelines

### Architecture & Design

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System architecture, module structure, data flow, design principles, and architecture evolution history
- **[AI_AGENT_GUIDE.md](./AI_AGENT_GUIDE.md)** - Examples of parallel AI agent development and collaboration patterns
- **[TESTING.md](./TESTING.md)** - Testing strategy, framework recommendations, and coverage goals

### Project Planning & Roadmap

- **[ROADMAP.md](./ROADMAP.md)** - Complete project roadmap with 7 milestones and 60+ issues organized for AI agent development

### Research & Technical Specifications

- **[docs/photo-recognition-research.md](./docs/photo-recognition-research.md)** - Comprehensive evaluation of photo recognition approaches (perceptual hashing, ML, cloud services) with technical recommendations
- **[docs/image-recognition-exploratory-analysis.md](./docs/image-recognition-exploratory-analysis.md)** - Exploratory analysis and benchmarking of image recognition pipeline: current failure points, performance metrics, comparative analysis vs QR codes, and actionable improvement roadmap
- **[docs/phase-2-benchmarking-guide.md](./docs/phase-2-benchmarking-guide.md)** - Phase 2 benchmarking guide for pHash algorithm and failure diagnostics: test protocol, performance targets, data collection templates, and validation steps
- **[docs/phase-2-angle-compensation-analysis.md](./docs/phase-2-angle-compensation-analysis.md)** - Phase 2 angle compensation analysis: approach comparison (multi-angle hashing, OpenCV perspective correction, enhanced framing guide), recommendations, and decision matrix
- **[docs/phase-2-migration-guide.md](./docs/phase-2-migration-guide.md)** - Migration guide for switching from dHash to pHash: step-by-step instructions, threshold adjustments, rollback plan, A/B testing, and troubleshooting
- **[docs/camera-settings-guide.md](./docs/camera-settings-guide.md)** - Complete guide to camera API constraints, browser support matrix, low-light optimization strategies, and black and white mode recommendations
- **[docs/grayscale-feature-implementation.md](./docs/grayscale-feature-implementation.md)** - Implementation details for grayscale camera feature flag, including technical specs, usage guide, and browser compatibility
- **[docs/mobile-first-refactor-summary.md](./docs/mobile-first-refactor-summary.md)** - Comprehensive summary of mobile-first CSS refactoring with detailed before/after comparisons, touch target improvements, and responsive breakpoint documentation
- **[docs/ACCESSIBILITY.md](./docs/ACCESSIBILITY.md)** - Unified WCAG 2.1 Level AA standards, contrast ratios, focus indicators, and component-level guidance
- **[docs/ACCESSIBILITY_QUICK_REFERENCE.md](./docs/ACCESSIBILITY_QUICK_REFERENCE.md)** - Developer checklist and color reference for day-to-day accessibility work
- **[docs/ACCESSIBILITY_VERIFICATION.md](./docs/ACCESSIBILITY_VERIFICATION.md)** - Formal verification report covering contrast audits, focus review, keyboard navigation, and testing status
- **[docs/code-analysis-tooling-research.md](./docs/code-analysis-tooling-research.md)** - Research and evaluation of tracing, logging, and code analysis tools for AI agent development
- **[docs/code-analysis-tooling-guide.md](./docs/code-analysis-tooling-guide.md)** - Comprehensive guide to using and interpreting automated code analysis tools (CodeQL, Codecov, npm audit, etc.)
- **[docs/code-analysis-examples.md](./docs/code-analysis-examples.md)** - Real-world examples showing what each automated tool looks like when it runs
- **[docs/codecov-setup-guide.md](./docs/codecov-setup-guide.md)** - Step-by-step guide for setting up Codecov coverage tracking with screenshots and troubleshooting
- **[docs/codeql-setup-guide.md](./docs/codeql-setup-guide.md)** - Step-by-step guide for enabling CodeQL code scanning on private repositories with solutions for common issues
- **[docs/vercel-setup-guide.md](./docs/vercel-setup-guide.md)** - Step-by-step guide for configuring Vercel deployments, troubleshooting deployment issues, and verifying production deployments

### User Guides

- **[docs/TEST_DATA_MODE_GUIDE.md](./docs/TEST_DATA_MODE_GUIDE.md)** - Complete user guide for testing the app with test data mode, including setup, workflow testing, feature identification, troubleshooting, and technical details on the auto-copy mechanism

---

## 🧩 Module Documentation

Each module has its own README defining its API contract, usage, and examples.

### Core Modules (`src/modules/`)

- **[camera-access/README.md](./src/modules/camera-access/README.md)** - Camera permission and MediaStream management
- **[camera-view/README.md](./src/modules/camera-view/README.md)** - Video display UI component with 3:2 and 2:3 aspect ratio overlays and toggle functionality
- **[motion-detection/README.md](./src/modules/motion-detection/README.md)** - Camera movement detection algorithm
- **[photo-recognition/README.md](./src/modules/photo-recognition/README.md)** - Photo matching using dHash or pHash perceptual hashing with functional frame cropping, hash generation tools, and debug API
  - **Phase 1 Enhancements**: Frame sharpness detection (motion blur mitigation), glare detection with user guidance, multi-exposure hashing for lighting robustness
  - **Phase 2 Enhancements**: pHash algorithm implementation (DCT-based, more robust to angles/lighting), failure-category diagnostics (motion-blur, glare, no-match, collision tracking)
  - **[photo-recognition/algorithms/dhash.ts](./src/modules/photo-recognition/algorithms/dhash.ts)** - dHash (Difference Hash) implementation - 128-bit gradient-based hash
  - **[photo-recognition/algorithms/phash.ts](./src/modules/photo-recognition/algorithms/phash.ts)** - pHash (Perceptual Hash) implementation - 64-bit DCT-based hash (Phase 2)
  - **[photo-recognition/algorithms/hamming.ts](./src/modules/photo-recognition/algorithms/hamming.ts)** - Hamming distance calculator
  - **[photo-recognition/algorithms/utils.ts](./src/modules/photo-recognition/algorithms/utils.ts)** - Image processing utilities (Laplacian variance for blur detection, glare detection, brightness adjustment for multi-exposure hashing)
  - **[photo-recognition/FrameQualityIndicator.tsx](./src/modules/photo-recognition/FrameQualityIndicator.tsx)** - UI component for displaying frame quality warnings ("Hold steady...", "Tilt to avoid glare")
  - **[photo-recognition/**tests**/calculateFramedRegion.test.ts](./src/modules/photo-recognition/**tests**/calculateFramedRegion.test.ts)** - Unit tests for frame cropping calculations (20 tests)
  - **[photo-recognition/**tests**/multiExposureMatching.test.ts](./src/modules/photo-recognition/**tests**/multiExposureMatching.test.ts)** - Unit tests for multi-exposure hash matching logic (8 tests)
  - **[photo-recognition/algorithms/**tests**/phash.test.ts](./src/modules/photo-recognition/algorithms/**tests**/phash.test.ts)** - Unit tests for pHash algorithm (17 tests, Phase 2)
- **[audio-playback/README.md](./src/modules/audio-playback/README.md)** - Audio control, playback, and fading
- **[concert-info/README.md](./src/modules/concert-info/README.md)** - Concert information display overlay
- **[gallery-layout/README.md](./src/modules/gallery-layout/README.md)** - Zine-like gallery UI layout with landing view and integrated camera
- **[debug-overlay/README.md](./src/modules/debug-overlay/README.md)** - Real-time photo recognition debugging overlay (Test Mode only)
- **[secret-settings/README.md](./src/modules/secret-settings/README.md)** - Hidden settings menu activated by triple-tap/click for feature flags and custom settings
  - **[secret-settings/DEVELOPER_GUIDE.md](./src/modules/secret-settings/DEVELOPER_GUIDE.md)** - Comprehensive guide for adding feature flags and custom settings
  - **[secret-settings/featureFlagConfig.ts](./src/modules/secret-settings/featureFlagConfig.ts)** - Feature flag definitions (Psychedelic Mode, Retro Sounds, Test Mode)
  - **[secret-settings/customSettingsConfig.ts](./src/modules/secret-settings/customSettingsConfig.ts)** - Custom settings definitions (Theme Mode, UI Style)
  - **[secret-settings/useFeatureFlags.ts](./src/modules/secret-settings/useFeatureFlags.ts)** - Feature flags state management hook
  - **[secret-settings/useCustomSettings.ts](./src/modules/secret-settings/useCustomSettings.ts)** - Custom settings state management hook
  - **[secret-settings/useRetroSounds.ts](./src/modules/secret-settings/useRetroSounds.ts)** - Retro sound effects hook using Web Audio API
  - **[secret-settings/PsychedelicEffect.tsx](./src/modules/secret-settings/PsychedelicEffect.tsx)** - Psychedelic visual effect component

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
- **[playwright.config.ts](./playwright.config.ts)** - Playwright configuration for visual regression testing
- **[tests/visual/README.md](./tests/visual/README.md)** - Visual regression testing guide, running tests, updating baselines, and troubleshooting

#### Module Tests

- **[src/modules/camera-view/CameraView.test.tsx](./src/modules/camera-view/CameraView.test.tsx)** - Unit tests for camera-view component (100% coverage)
- **[src/modules/secret-settings/useTripleTap.test.ts](./src/modules/secret-settings/useTripleTap.test.ts)** - Unit tests for triple-tap detection hook
- **[src/modules/secret-settings/SecretSettings.test.tsx](./src/modules/secret-settings/SecretSettings.test.tsx)** - Unit tests for secret settings component
- **[src/modules/secret-settings/useFeatureFlags.test.ts](./src/modules/secret-settings/useFeatureFlags.test.ts)** - Unit tests for feature flags hook
- **[src/modules/secret-settings/useCustomSettings.test.ts](./src/modules/secret-settings/useCustomSettings.test.ts)** - Unit tests for custom settings hook
- **[src/modules/photo-recognition/algorithms/**tests**/dhash.test.ts](./src/modules/photo-recognition/algorithms/**tests**/dhash.test.ts)** - Unit tests for dHash algorithm (17 tests)
- **[src/modules/photo-recognition/algorithms/**tests**/hamming.test.ts](./src/modules/photo-recognition/algorithms/**tests**/hamming.test.ts)** - Unit tests for Hamming distance (20 tests)
- **[src/modules/photo-recognition/algorithms/**tests**/utils.test.ts](./src/modules/photo-recognition/algorithms/**tests**/utils.test.ts)** - Unit tests for image processing utilities (22 tests)
- **[src/modules/photo-recognition/**tests**/calculateFramedRegion.test.ts](./src/modules/photo-recognition/**tests**/calculateFramedRegion.test.ts)** - Unit tests for frame cropping calculations (20 tests)

#### Visual Regression Tests

- **[tests/visual/landing-page.spec.ts](./tests/visual/landing-page.spec.ts)** - Visual regression tests for landing page at multiple viewports
- **[tests/visual/camera-view.spec.ts](./tests/visual/camera-view.spec.ts)** - Visual regression tests for camera view states
- **[tests/visual/ui-components.spec.ts](./tests/visual/ui-components.spec.ts)** - Visual regression tests for UI components, themes, responsive design, and interactive states

### Code Quality

- **[eslint.config.js](./eslint.config.js)** - ESLint linting rules (flat config format)
- **[.prettierrc.json](./.prettierrc.json)** - Prettier code formatting rules
- **[.prettierignore](./.prettierignore)** - Files excluded from Prettier formatting

### Styling

- **[src/index.css](./src/index.css)** - Global styles and CSS reset with custom color variables
- **[src/modules/camera-view/CameraView.module.css](./src/modules/camera-view/CameraView.module.css)** - CSS Module for CameraView component
- **[src/modules/gallery-layout/GalleryLayout.module.css](./src/modules/gallery-layout/GalleryLayout.module.css)** - CSS Module for GalleryLayout component
- **[src/modules/concert-info/InfoDisplay.module.css](./src/modules/concert-info/InfoDisplay.module.css)** - CSS Module for InfoDisplay component
- **[src/modules/secret-settings/SecretSettings.module.css](./src/modules/secret-settings/SecretSettings.module.css)** - CSS Module for SecretSettings component

---

## 🤖 GitHub & CI/CD

### Workflows

- **[.github/workflows/ci.yml](./.github/workflows/ci.yml)** - GitHub Actions CI pipeline (lint, format, type-check, test with coverage, build, bundle size check, npm audit)
- **[.github/workflows/visual-regression.yml](./.github/workflows/visual-regression.yml)** - Playwright visual regression testing workflow (separate from main CI)
- **[.github/workflows/pr-checks-monitor.yml](./.github/workflows/pr-checks-monitor.yml)** - Automated PR monitoring workflow that comments on PRs with failing checks and enforces AI agent compliance
- **[.github/workflows/manage-labels.yml](./.github/workflows/manage-labels.yml)** - Label management workflow that creates and maintains required labels (ci-failing, needs-fixes)
- **[.github/workflows/close-stale-failing-prs.yml](./.github/workflows/close-stale-failing-prs.yml)** - Automated workflow to close PRs with failing checks after 7 days (enforces AI agent policy)

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

### Issue Templates (Feature-based)

- **[implement-functional-framing-guides.md](./.github/ISSUE_TEMPLATE/implement-functional-framing-guides.md)** - Feature: Implement functional framing guides with dual aspect ratios (3:2 and 2:3) to make framing guide crop recognition region
- **[refactor-consolidate-feature-flags.md](./.github/ISSUE_TEMPLATE/refactor-consolidate-feature-flags.md)** - Refactor: Consolidate duplicate feature flag systems
- **[fix-test-mode-photo-recognition.md](./.github/ISSUE_TEMPLATE/fix-test-mode-photo-recognition.md)** - Bug: Fix test mode photo recognition
- **[digital-gallery-mode.md](./.github/ISSUE_TEMPLATE/digital-gallery-mode.md)** - Feature: Enable remote gallery viewing
- **[cleanup-outdated-docs.md](./.github/ISSUE_TEMPLATE/cleanup-outdated-docs.md)** - Cleanup: Remove outdated documentation
- **[optimize-mp3-storage.md](./.github/ISSUE_TEMPLATE/optimize-mp3-storage.md)** - Chore: Design a scalable MP3 storage strategy

### Custom Agents

- **[.github/agents/README.md](./.github/agents/README.md)** - Guide to using GitHub Copilot custom agents, testing approach, and customization instructions
- **[.github/agents/implementation-planner.md](./.github/agents/implementation-planner.md)** - Technical planning specialist that creates detailed implementation plans and technical specifications
- **[.github/agents/bug-fix-teammate.md](./.github/agents/bug-fix-teammate.md)** - Bug-fixing specialist that identifies critical bugs and implements targeted fixes
- **[.github/agents/cleanup-specialist.md](./.github/agents/cleanup-specialist.md)** - Code cleanup specialist that improves code quality, removes duplication, and enhances maintainability

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

**Feature Issues**

- **[refactor-consolidate-feature-flags.md](./.github/ISSUE_TEMPLATE/refactor-consolidate-feature-flags.md)** - Refactor: Consolidate duplicate feature flag systems into single source of truth
- **[fix-test-mode-photo-recognition.md](./.github/ISSUE_TEMPLATE/fix-test-mode-photo-recognition.md)** - Bug: Fix test mode to enable photo recognition with test images and add debug logging
- **[digital-gallery-mode.md](./.github/ISSUE_TEMPLATE/digital-gallery-mode.md)** - Feature: Enable remote users to experience Photo Signal by pointing camera at campmiles.com blog images
- **[cleanup-outdated-docs.md](./.github/ISSUE_TEMPLATE/cleanup-outdated-docs.md)** - Cleanup: Audit and remove outdated ISSUE_TRACKING.md and MIGRATION.md files after extracting valuable content
- **[implement-functional-framing-guides.md](./.github/ISSUE_TEMPLATE/implement-functional-framing-guides.md)** - Feature: Implement functional framing guides with dual aspect ratios (3:2 landscape and 2:3 portrait) to crop recognition to framed region
- **[add-apply-button-secret-settings.md](./.github/ISSUE_TEMPLATE/add-apply-button-secret-settings.md)** - Feature: Add "Send It" confirmation button to apply changes and close secret settings menu
- **[fix-triple-tap-timing.md](./.github/ISSUE_TEMPLATE/fix-triple-tap-timing.md)** - Bug: Fix triple-tap detection to require rapid succession instead of slow sequential taps

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

- **[scripts/README.md](./scripts/README.md)** - Documentation for all helper scripts, including hash generation tools
- **[scripts/dev.sh](./scripts/dev.sh)** - Start development server (local or Docker)
- **[scripts/build.sh](./scripts/build.sh)** - Build for production (local or Docker)
- **[scripts/test.sh](./scripts/test.sh)** - Run tests (local or Docker)
- **[scripts/lint.sh](./scripts/lint.sh)** - Run linting (local or Docker)
- **[scripts/format.sh](./scripts/format.sh)** - Format code (local or Docker)
- **[scripts/create-sample-audio.sh](./scripts/create-sample-audio.sh)** - Generate sample audio file
- **[scripts/check-bundle-size.sh](./scripts/check-bundle-size.sh)** - Check build bundle size against limits (used in CI)
- **[scripts/generate-photo-hashes.html](./scripts/generate-photo-hashes.html)** - Browser-based photo hash generator (drag-and-drop interface)
- **[scripts/generate-photo-hashes.js](./scripts/generate-photo-hashes.js)** - Node.js photo hash generator script (`npm run generate-hashes`)
- **[scripts/create-easy-test-images.js](./scripts/create-easy-test-images.js)** - Canvas-based generator for high-contrast calibration targets (`npm run create-easy-images`)

---

## 📦 Data & Assets

### Production Data

- **[public/data.json](./public/data.json)** - Concert metadata (band, venue, date, audio file)
- **[public/audio/README.md](./public/audio/README.md)** - Audio files directory and instructions

### Test Assets (CC0 Licensed)

- **[assets/test-images/README.md](./assets/test-images/README.md)** - Test images (synthetic, calibration, and sample photos) for development and automated testing
- **[assets/test-audio/README.md](./assets/test-audio/README.md)** - Test audio files (CC0 music, tones, and noise) for playback and audio pipeline validation
- **[assets/test-data/README.md](./assets/test-data/README.md)** - Test data files (JSON, CSV, etc.) for data service and integration tests
- **[assets/example-real-songs/README.md](./assets/example-real-songs/README.md)** - Real-world MP3 library paired with example photos for immersive test mode sessions

### Example Real Photos

- **[assets/example-real-photos/README.md](./assets/example-real-photos/README.md)** - Real concert photos for gallery testing and photo recognition validation (5 JPEG files)

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

- ✅ Root documentation (8 files)
- ✅ Research & technical specifications (15 files - including exploratory analysis, Phase 2 benchmarking guide, Phase 2 angle compensation analysis, Phase 2 migration guide, grayscale feature implementation, mobile-first refactor summary, accessibility guide, camera settings guide, CodeQL, Codecov, and Vercel setup guides)
- ✅ User guides (1 file - TEST_DATA_MODE_GUIDE.md)
- ✅ Module READMEs (8 files - including secret-settings)
- ✅ Module developer guides (1 file - secret-settings developer guide)
- ✅ Module implementation files (7 files - secret-settings feature flags, custom settings, hooks, and effects)
- ✅ Photo recognition algorithms (4 files - dhash, phash, hamming, utils)
- ✅ Configuration files (15 files - including playwright.config.ts)
- ✅ GitHub Actions & workflows (6 files - CI workflow, visual regression, PR checks monitor, label management, stale PR closure, and Dependabot config)
- ✅ GitHub Actions - custom actions (2 files)
- ✅ GitHub templates (1 file - PR template)
- ✅ GitHub Copilot custom agents (4 files - README, implementation planner, bug fix teammate, cleanup specialist)
- ✅ Issue templates (22 files - includes all issue templates)
- ✅ Development environment configs (3 files)
- ✅ Docker configuration (4 files)
- ✅ Helper scripts (9 files including README, easy image generator, and bundle size checker)
- ✅ Data and asset documentation (7 files - production data, test assets, and example photos)
- ✅ Test infrastructure (4 files - Vitest setup, mocks, Playwright config, visual test README)
- ✅ Module tests (10 files - including secret-settings hooks tests, photo recognition frame cropping tests, and phash algorithm tests)
- ✅ Visual regression tests (3 files - landing page, camera view, UI components)

**Total**: 128 documented files

Last updated: 2025-11-16
