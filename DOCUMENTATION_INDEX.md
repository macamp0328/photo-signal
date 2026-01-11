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
- **[FUTURE_FEATURES.md](./FUTURE_FEATURES.md)** - Consolidated list of unimplemented features and enhancement ideas
- **[PARALLEL_RECOGNITION_IMPLEMENTATION.md](./PARALLEL_RECOGNITION_IMPLEMENTATION.md)** - Implementation summary for parallel multi-algorithm photo recognition (dHash + pHash + ORB with weighted voting)

### Research & Technical Guides

- **[docs/PHOTO_RECOGNITION_DEEP_DIVE.md](./docs/PHOTO_RECOGNITION_DEEP_DIVE.md)** - **⭐ ESSENTIAL**: Comprehensive deep-dive guide to achieving successful photo recognition with printed photographs, including internal mechanics, configuration guidance, hash generation workflow, systematic testing, and troubleshooting (START HERE)
- **[docs/PHOTO_RECOGNITION_QUICK_REF.md](./docs/PHOTO_RECOGNITION_QUICK_REF.md)** - **Quick reference card** for photo recognition configuration, troubleshooting, and common tasks
- **[docs/ORB_OPTIMIZATION_RESEARCH.md](./docs/ORB_OPTIMIZATION_RESEARCH.md)** - **ORB Performance Research**: Root cause analysis and optimization of ORB algorithm parameters for print-to-camera photo matching, including octave distribution analysis and configuration improvements
- **[docs/photo-recognition-research.md](./docs/photo-recognition-research.md)** - Comprehensive evaluation of photo recognition approaches (perceptual hashing, ML, cloud services) with technical recommendations
- **[docs/camera-settings-guide.md](./docs/camera-settings-guide.md)** - Complete guide to camera API constraints, browser support matrix, low-light optimization strategies, and black and white mode recommendations
- **[docs/telemetry-interpretation-guide.md](./docs/telemetry-interpretation-guide.md)** - Complete guide to understanding and using photo recognition telemetry data, including failure category analysis, debugging workflows, and regression testing
- **[docs/code-analysis-tooling-guide.md](./docs/code-analysis-tooling-guide.md)** - Comprehensive guide to using and interpreting automated code analysis tools (CodeQL, Codecov, npm audit, etc.)
- **[docs/codecov-setup-guide.md](./docs/codecov-setup-guide.md)** - Step-by-step guide for setting up Codecov coverage tracking with screenshots and troubleshooting
- **[docs/codeql-setup-guide.md](./docs/codeql-setup-guide.md)** - Step-by-step guide for enabling CodeQL code scanning on private repositories with solutions for common issues
- **[docs/vercel-setup-guide.md](./docs/vercel-setup-guide.md)** - Step-by-step guide for configuring Vercel deployments, troubleshooting deployment issues, and verifying production deployments
- **[docs/AUDIO_R2_WORKER.md](./docs/AUDIO_R2_WORKER.md)** - Cloudflare Worker audio proxy configuration, R2 bindings, and data rewrites

### Accessibility

- **[docs/ACCESSIBILITY.md](./docs/ACCESSIBILITY.md)** - Unified WCAG 2.1 Level AA standards, contrast ratios, focus indicators, and component-level guidance
- **[docs/ACCESSIBILITY_QUICK_REFERENCE.md](./docs/ACCESSIBILITY_QUICK_REFERENCE.md)** - Developer checklist and color reference for day-to-day accessibility work
- **[docs/ACCESSIBILITY_VERIFICATION.md](./docs/ACCESSIBILITY_VERIFICATION.md)** - Formal verification report covering contrast audits, focus review, keyboard navigation, and testing status

### User Guides

- **[docs/TEST_DATA_MODE_GUIDE.md](./docs/TEST_DATA_MODE_GUIDE.md)** - Complete user guide for testing the app with test data mode, including setup, workflow testing, feature identification, troubleshooting, and technical details on the auto-copy mechanism

### Issue Drafts

- **[docs/issues/download-strip-embedded-metadata.md](./docs/issues/download-strip-embedded-metadata.md)** - Draft issue describing how to disable embedded thumbnails/metadata in downloaded Opus files while keeping standalone cover art
- **[docs/issues/audio-metadata-export.md](./docs/issues/audio-metadata-export.md)** - Draft issue for capturing full source metadata once in `.metadata.json` so encoded Opus files stay lean
- **[docs/issues/opus-bitrate-guardrails.md](./docs/issues/opus-bitrate-guardrails.md)** - Draft issue outlining bitrate guardrails that prevent upscaling beyond 160 kbps and log the chosen bitrate per track

---

## 🧩 Module Documentation

Each module has its own README defining its API contract, usage, and examples.

### Core Modules (`src/modules/`)

- **[camera-access/README.md](./src/modules/camera-access/README.md)** - Camera permission and MediaStream management
- **[camera-view/README.md](./src/modules/camera-view/README.md)** - Video display UI component with 3:2 and 2:3 aspect ratio overlays and toggle functionality
- **[motion-detection/README.md](./src/modules/motion-detection/README.md)** - Camera movement detection algorithm
- **[photo-recognition/README.md](./src/modules/photo-recognition/README.md)** - Photo matching using dHash, pHash, or ORB algorithms with functional frame cropping, hash generation tools, and debug API
  - **Phase 1 Enhancements**: Frame sharpness detection (motion blur mitigation), glare detection with user guidance, multi-exposure hashing for lighting robustness
  - **Phase 2 Enhancements**: pHash algorithm implementation (DCT-based, more robust to angles/lighting), failure-category diagnostics (motion-blur, glare, no-match, collision tracking)
  - **Phase 3 Enhancements**: ORB algorithm implementation (feature-based, rotation and scale invariant for print-to-camera matching)
  - **Phase 4 Enhancements**: Parallel recognition pipeline (concurrent dHash + pHash + ORB with weighted voting)
  - **[photo-recognition/algorithms/dhash.ts](./src/modules/photo-recognition/algorithms/dhash.ts)** - dHash (Difference Hash) implementation - 128-bit gradient-based hash
  - **[photo-recognition/algorithms/phash.ts](./src/modules/photo-recognition/algorithms/phash.ts)** - pHash (Perceptual Hash) implementation - 64-bit DCT-based hash (Phase 2)
  - **[photo-recognition/algorithms/orb/README.md](./src/modules/photo-recognition/algorithms/orb/README.md)** - ORB (Oriented FAST and Rotated BRIEF) feature matching - multi-scale keypoint detection with rotation invariance (Phase 3)
  - **[photo-recognition/algorithms/orb/orb.ts](./src/modules/photo-recognition/algorithms/orb/orb.ts)** - ORB implementation with optimized parameters for print-to-camera matching
  - **[photo-recognition/algorithms/orb/**tests**/orb.test.ts](./src/modules/photo-recognition/algorithms/orb/**tests**/orb.test.ts)** - ORB algorithm unit tests (18 tests)
  - **[photo-recognition/algorithms/orb/**tests**/orb-octave-analysis.test.ts](./src/modules/photo-recognition/algorithms/orb/**tests**/orb-octave-analysis.test.ts)** - ORB octave distribution analysis tests (5 tests)
  - **[photo-recognition/algorithms/parallel-recognizer.ts](./src/modules/photo-recognition/algorithms/parallel-recognizer.ts)** - Parallel recognition orchestrator - runs dHash, pHash, and ORB concurrently with weighted voting (Phase 4)
  - **[photo-recognition/algorithms/PARALLEL_RECOGNITION.md](./src/modules/photo-recognition/algorithms/PARALLEL_RECOGNITION.md)** - Parallel recognition API reference, usage guide, and configuration recommendations
  - **[photo-recognition/algorithms/hamming.ts](./src/modules/photo-recognition/algorithms/hamming.ts)** - Hamming distance calculator
  - **[photo-recognition/algorithms/utils.ts](./src/modules/photo-recognition/algorithms/utils.ts)** - Image processing utilities (Laplacian variance for blur detection, glare detection, brightness adjustment for multi-exposure hashing)
  - **[photo-recognition/FrameQualityIndicator.tsx](./src/modules/photo-recognition/FrameQualityIndicator.tsx)** - UI component for displaying frame quality warnings ("Hold steady...", "Tilt to avoid glare")
  - **[photo-recognition/TelemetryExport.tsx](./src/modules/photo-recognition/TelemetryExport.tsx)** - Telemetry data export component for Test Mode (JSON and Markdown reports)
  - **[photo-recognition/**tests**/calculateFramedRegion.test.ts](./src/modules/photo-recognition/**tests**/calculateFramedRegion.test.ts)** - Unit tests for frame cropping calculations (20 tests)
  - **[photo-recognition/**tests**/multiExposureMatching.test.ts](./src/modules/photo-recognition/**tests**/multiExposureMatching.test.ts)** - Unit tests for multi-exposure hash matching logic (8 tests)
  - **[photo-recognition/**tests**/edgeCaseAccuracy.test.ts](./src/modules/photo-recognition/**tests**/edgeCaseAccuracy.test.ts)** - Edge case accuracy regression tests validating recognition thresholds (17 tests)
  - **[photo-recognition/**tests**/parallelRecognition.test.ts](./src/modules/photo-recognition/**tests**/parallelRecognition.test.ts)** - Integration tests for parallel recognition hook integration (6 tests)
  - **[photo-recognition/algorithms/**tests**/phash.test.ts](./src/modules/photo-recognition/algorithms/**tests**/phash.test.ts)** - Unit tests for pHash algorithm (17 tests, Phase 2)
  - **[photo-recognition/algorithms/**tests**/parallel-recognizer.test.ts](./src/modules/photo-recognition/algorithms/**tests**/parallel-recognizer.test.ts)** - Unit tests for parallel recognition (13 tests)
- **[photo-rectangle-detection/README.md](./src/modules/photo-rectangle-detection/README.md)** - Dynamic rectangle detection for printed photographs using edge detection and contour analysis
  - **[photo-rectangle-detection/RectangleDetectionService.ts](./src/modules/photo-rectangle-detection/RectangleDetectionService.ts)** - Core detection algorithm with Sobel edge detection, Gaussian blur, and contour tracing
  - **[photo-rectangle-detection/RectangleOverlay.tsx](./src/modules/photo-rectangle-detection/RectangleOverlay.tsx)** - Visual feedback component showing detected rectangle with state-based styling
  - **[photo-rectangle-detection/types.ts](./src/modules/photo-rectangle-detection/types.ts)** - TypeScript interfaces for detection results and configuration
- **[audio-playback/README.md](./src/modules/audio-playback/README.md)** - Audio control, playback, and fading
- **[concert-info/README.md](./src/modules/concert-info/README.md)** - Concert information display overlay
- **[gallery-layout/README.md](./src/modules/gallery-layout/README.md)** - Zine-like gallery UI layout with landing view and integrated camera
- **[debug-overlay/README.md](./src/modules/debug-overlay/README.md)** - Real-time photo recognition debugging overlay (Test Mode only)
- **[secret-settings/README.md](./src/modules/secret-settings/README.md)** - Hidden settings menu activated by triple-tap/click for feature flags and custom settings
  - **[secret-settings/DEVELOPER_GUIDE.md](./src/modules/secret-settings/DEVELOPER_GUIDE.md)** - Comprehensive guide for adding feature flags and custom settings
  - **[secret-settings/config.ts](./src/modules/secret-settings/config.ts)** - Unified configuration file containing feature flags and custom settings definitions
  - **[secret-settings/useFeatureFlags.ts](./src/modules/secret-settings/useFeatureFlags.ts)** - Feature flags state management hook
  - **[secret-settings/useCustomSettings.ts](./src/modules/secret-settings/useCustomSettings.ts)** - Custom settings state management hook

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
- **[wrangler.toml](./wrangler.toml)** - Cloudflare Worker configuration with R2 bucket binding

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

#### Integration Tests

- **[src/**tests**/integration/README.md](./src/**tests**/integration/README.md)** - Integration test documentation, patterns, and examples
- **[src/**tests**/integration/setup.ts](./src/**tests**/integration/setup.ts)** - Shared test utilities and mocks for integration tests
- **[src/**tests**/integration/photo-to-audio.test.tsx](./src/**tests**/integration/photo-to-audio.test.tsx)** - Photo recognition → audio playback workflow tests (7 tests)
- **[src/**tests**/integration/motion-to-fade.test.tsx](./src/**tests**/integration/motion-to-fade.test.tsx)** - Motion detection → audio fade workflow tests (3 tests)
- **[src/**tests**/integration/camera-to-recognition.test.tsx](./src/**tests**/integration/camera-to-recognition.test.tsx)** - Camera access → photo recognition workflow tests (7 tests)
- **[src/**tests**/integration/recognition-to-info.test.tsx](./src/**tests**/integration/recognition-to-info.test.tsx)** - Recognition → concert info display workflow tests (5 tests)
- **[src/**tests**/integration/feature-flags.test.tsx](./src/**tests**/integration/feature-flags.test.tsx)** - Feature flags → module behavior workflow tests (10 tests)
- **[src/**tests**/integration/app-lifecycle.test.tsx](./src/**tests**/integration/app-lifecycle.test.tsx)** - App lifecycle (initialization, cleanup) tests (13 tests)

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
- **[.github/workflows/edge-case-accuracy.yml](./.github/workflows/edge-case-accuracy.yml)** - Edge case accuracy regression testing workflow that validates photo recognition thresholds and posts PR reports (only runs when photo recognition code changes)
- **[.github/workflows/auto-fix-copilot-pr.yml](./.github/workflows/auto-fix-copilot-pr.yml)** - Automated workflow that fixes formatting and linting issues in Copilot PRs when CI fails
- **[.github/workflows/manage-labels.yml](./.github/workflows/manage-labels.yml)** - Label management workflow that creates and maintains required labels for Dependabot

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
- **[optimize-opus-storage.md](./.github/ISSUE_TEMPLATE/optimize-opus-storage.md)** - Chore: Design a scalable Opus storage strategy

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
- **[scripts/audio-workflow/download/README.md](./scripts/audio-workflow/download/README.md)** - Quick-start guide for yt-dlp downloader prerequisites, config, and sample commands. **Includes comprehensive metadata structure documentation** (`.metadata.json` format, `ytInfo` field, single source of truth strategy)
- **[scripts/audio-workflow/README.md](./scripts/audio-workflow/README.md)** - Overview of the download → organize+encode → update pipeline with links to each stage. **Documents the "capture once, store outside" metadata philosophy**
- **[scripts/audio-workflow/encode/README.md](./scripts/audio-workflow/encode/README.md)** - Combined organize + encode playbook covering cataloging, normalization, Opus mastering, and manifest generation. **Explains minimal Opus embedding vs. rich manifest metadata strategy**
- **[scripts/audio-workflow/encode/metadata-overrides.example.json](./scripts/audio-workflow/encode/metadata-overrides.example.json)** - Sample metadata override mapping showing how to pin custom dates/venues for the encode stage
- **[scripts/audio-workflow/update/upload-to-r2.js](./scripts/audio-workflow/update/upload-to-r2.js)** - Cloudflare R2 uploader CLI with hash-based skip logic, concurrency controls, and CDN URL summaries
- **[scripts/audio-workflow/update/upload-audio-local.sh](./scripts/audio-workflow/update/upload-audio-local.sh)** - Bash helper that sources `.env.local` before invoking the uploader
- **[.env.example](./.env.example)** - Template for local environment variables (Cloudflare R2 credentials, upload defaults)
- **[scripts/audio-workflow/download/download-yt-song.config.example.json](./scripts/audio-workflow/download/download-yt-song.config.example.json)** - Sample configuration for the yt-dlp download helper (copy to `download-yt-song.config.json` and customize defaults)
- **[scripts/audio-workflow/download/download-yt-song.config.json](./scripts/audio-workflow/download/download-yt-song.config.json)** - Local default configuration pointing to the Photo Signal playlist and `../downloads` output folder
- **[scripts/dev.sh](./scripts/dev.sh)** - Start development server (local or Docker)
- **[scripts/build.sh](./scripts/build.sh)** - Build for production (local or Docker)
- **[scripts/test.sh](./scripts/test.sh)** - Run tests (local or Docker)
- **[scripts/lint.sh](./scripts/lint.sh)** - Run linting (local or Docker)
- **[scripts/format.sh](./scripts/format.sh)** - Format code (local or Docker)
- **[scripts/create-sample-audio.sh](./scripts/create-sample-audio.sh)** - Generate sample audio file
- **[scripts/check-bundle-size.sh](./scripts/check-bundle-size.sh)** - Check build bundle size against limits (used in CI)
- **[scripts/generate-photo-hashes.html](./scripts/generate-photo-hashes.html)** - Browser-based photo hash generator (drag-and-drop interface)
- **[scripts/update-recognition-data.js](./scripts/update-recognition-data.js)** - Unified CLI that refreshes dHash/pHash variants, ORB payloads, and now provides ad-hoc hash generation via `--paths-mode` (`npm run update-recognition-data`, `npm run generate-hashes`)
- **[scripts/create-easy-test-images.js](./scripts/create-easy-test-images.js)** - Canvas-based generator for high-contrast calibration targets (`npm run create-easy-images`)
- **[scripts/create-edge-case-test-images.js](./scripts/create-edge-case-test-images.js)** - Generator for edge case test images covering motion blur, glare, lighting, and angle challenges (`npm run create-edge-case-images`)

---

## 📦 Data & Assets

### Production Data

- **[public/data.json](./public/data.json)** - Concert metadata (band, venue, date, audio file)
- **[public/audio/README.md](./public/audio/README.md)** - Audio files directory and instructions

### Test Assets (CC0 Licensed)

- **[assets/test-images/README.md](./assets/test-images/README.md)** - Test images (synthetic, calibration, and sample photos) for development and automated testing
- **[assets/test-audio/README.md](./assets/test-audio/README.md)** - Test audio files (CC0 music, tones, and noise) for playback and audio pipeline validation
- **[assets/test-data/README.md](./assets/test-data/README.md)** - Test data files (JSON, CSV, etc.) for data service and integration tests
- **[assets/example-real-songs/README.md](./assets/example-real-songs/README.md)** - Real-world Opus library paired with example photos for immersive test mode sessions

### Example Real Photos

- **[assets/example-real-photos/README.md](./assets/example-real-photos/README.md)** - Real concert photos for gallery testing and photo recognition validation (7 JPEG files)

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

- ✅ Root documentation (9 files - README, SETUP, ARCHITECTURE, AI_AGENT_GUIDE, CONTRIBUTING, TESTING, DOCKER, FUTURE_FEATURES, ASSET_LICENSES, PARALLEL_RECOGNITION_IMPLEMENTATION)
- ✅ Technical guides & research (12 files - **photo recognition deep dive**, **quick reference**, photo recognition research, camera settings, telemetry, code analysis tooling, codecov/codeql/vercel setup guides)
- ✅ Accessibility (3 files - standards, quick reference, verification report)
- ✅ User guides (1 file - TEST_DATA_MODE_GUIDE.md)
- ✅ Module READMEs (9 files - including secret-settings and photo-rectangle-detection)
- ✅ Module developer guides (1 file - secret-settings developer guide)
- ✅ Module implementation files (13 files - secret-settings feature flags, custom settings, hooks, effects, photo-rectangle-detection service and overlay, parallel-recognizer)
- ✅ Photo recognition algorithms (5 files - dhash, phash, hamming, utils, parallel-recognizer with PARALLEL_RECOGNITION.md)
- ✅ Configuration files (16 files - including playwright.config.ts and wrangler.toml)
- ✅ GitHub Actions & workflows (5 files - CI workflow, visual regression, edge case accuracy, auto-fix Copilot PR, manage labels)
- ✅ GitHub Actions - custom actions (2 files)
- ✅ GitHub templates (1 file - PR template)
- ✅ GitHub Copilot custom agents (4 files - README, implementation planner, bug fix teammate, cleanup specialist)
- ✅ Issue templates (22 files - includes all issue templates)
- ✅ Development environment configs (3 files)
- ✅ Docker configuration (4 files)
- ✅ Helper scripts (10 files including README, cleanup-docs, easy image generator, and bundle size checker)
- ✅ Data and asset documentation (7 files - production data, test assets, and example photos)
- ✅ Test infrastructure (4 files - Vitest setup, mocks, Playwright config, visual test README)
- ✅ Module tests (12 files - including secret-settings hooks tests, photo recognition frame cropping tests, phash algorithm tests, parallel-recognizer tests)
- ✅ Visual regression tests (3 files - landing page, camera view, UI components)

**Total**: 118 documented files (21 historical/redundant docs removed)

Last updated: 2025-11-24
