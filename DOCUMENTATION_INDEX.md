# Documentation Index

> Central index of all project documentation.

---

## Core Documentation

- **[README.md](./README.md)** — Project overview, features, and setup
- **[SETUP.md](./SETUP.md)** — Development environment, CI/CD, DevContainer, Vercel deployment
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** — System architecture, module structure, data flow, design principles
- **[CONTRIBUTING.md](./CONTRIBUTING.md)** — Contribution guidelines, feature-branch/PR workflow, and quality gates
- **[TESTING.md](./TESTING.md)** — Testing strategy, framework, and coverage goals
- **[DOCKER.md](./DOCKER.md)** — Docker and Docker Compose setup
- **[FUTURE_FEATURES.md](./FUTURE_FEATURES.md)** — Unimplemented features and enhancement ideas

## AI Agent Instructions

- **[CLAUDE.md](./CLAUDE.md)** — Claude Code agent instructions
- **[.github/copilot-instructions.md](./.github/copilot-instructions.md)** — GitHub Copilot agent instructions
- **[.github/agents/README.md](./.github/agents/README.md)** — Custom Copilot agents (implementation-planner, bug-fix-teammate, cleanup-specialist)

## Technical Guides

- **[docs/PHOTO_RECOGNITION_DEEP_DIVE.md](./docs/PHOTO_RECOGNITION_DEEP_DIVE.md)** — Comprehensive photo recognition guide (start here)
- **[docs/PHOTO_RECOGNITION_QUICK_REF.md](./docs/PHOTO_RECOGNITION_QUICK_REF.md)** — Photo recognition quick reference card
- **[docs/RECOGNITION_REMEDIATION_PROGRESS_2026-02-16.md](./docs/RECOGNITION_REMEDIATION_PROGRESS_2026-02-16.md)** — PR #250 remediation progress log
- **[docs/camera-settings-guide.md](./docs/camera-settings-guide.md)** — Camera API, browser support, low-light optimization
- **[docs/telemetry-interpretation-guide.md](./docs/telemetry-interpretation-guide.md)** — Recognition telemetry and debugging
- **[docs/AUDIO_R2_WORKER.md](./docs/AUDIO_R2_WORKER.md)** — Cloudflare Worker audio proxy and R2 setup
- **[docs/TEST_DATA_MODE_GUIDE.md](./docs/TEST_DATA_MODE_GUIDE.md)** — Test data mode user guide
- **[docs/code-analysis-tooling-guide.md](./docs/code-analysis-tooling-guide.md)** — CodeQL, Codecov, npm audit guide
- **[docs/codecov-setup-guide.md](./docs/codecov-setup-guide.md)** — Codecov setup guide
- **[docs/codeql-setup-guide.md](./docs/codeql-setup-guide.md)** — CodeQL setup guide
- **[docs/vercel-setup-guide.md](./docs/vercel-setup-guide.md)** — Vercel deployment guide

## Accessibility

- **[docs/ACCESSIBILITY.md](./docs/ACCESSIBILITY.md)** — WCAG 2.1 Level AA standards
- **[docs/ACCESSIBILITY_QUICK_REFERENCE.md](./docs/ACCESSIBILITY_QUICK_REFERENCE.md)** — Developer checklist and color reference
- **[docs/ACCESSIBILITY_VERIFICATION.md](./docs/ACCESSIBILITY_VERIFICATION.md)** — Formal verification report

## Module READMEs

Each module has a README defining its API contract:

- **[src/modules/camera-access/README.md](./src/modules/camera-access/README.md)** — Camera permission and MediaStream management
- **[src/modules/camera-view/README.md](./src/modules/camera-view/README.md)** — Video display with aspect ratio overlays
- **[src/modules/motion-detection/README.md](./src/modules/motion-detection/README.md)** — Movement detection algorithm
- **[src/modules/photo-recognition/README.md](./src/modules/photo-recognition/README.md)** — pHash recognition pipeline
- **[src/modules/photo-rectangle-detection/README.md](./src/modules/photo-rectangle-detection/README.md)** — Rectangle detection for printed photos
- **[src/modules/audio-playback/README.md](./src/modules/audio-playback/README.md)** — Audio control and fading
- **[src/modules/concert-info/README.md](./src/modules/concert-info/README.md)** — Concert info display overlay
- **[src/modules/gallery-layout/README.md](./src/modules/gallery-layout/README.md)** — Zine-like gallery UI
- **[src/modules/debug-overlay/README.md](./src/modules/debug-overlay/README.md)** — Recognition debugging overlay
- **[src/modules/secret-settings/README.md](./src/modules/secret-settings/README.md)** — Hidden settings menu (feature flags)
- **[src/modules/secret-settings/DEVELOPER_GUIDE.md](./src/modules/secret-settings/DEVELOPER_GUIDE.md)** — Adding feature flags and custom settings
- **[src/services/data-service/README.md](./src/services/data-service/README.md)** — Concert data loading and caching

## Scripts & Workflows

- **[scripts/README.md](./scripts/README.md)** — Helper scripts documentation
- **[scripts/audio-workflow/README.md](./scripts/audio-workflow/README.md)** — Audio download/encode/upload pipeline
- **[scripts/audio-workflow/download/README.md](./scripts/audio-workflow/download/README.md)** — yt-dlp downloader guide
- **[scripts/audio-workflow/encode/README.md](./scripts/audio-workflow/encode/README.md)** — Opus encoding playbook
- **[tests/visual/README.md](./tests/visual/README.md)** — Visual regression testing guide

## Asset Documentation

- **[assets/test-images/README.md](./assets/test-images/README.md)** — Test images for development
- **[assets/test-audio/README.md](./assets/test-audio/README.md)** — Test audio files
- **[assets/test-data/README.md](./assets/test-data/README.md)** — Test data files
- **[assets/example-real-songs/README.md](./assets/example-real-songs/README.md)** — Real-world Opus library for test mode
- **[assets/example-real-photos/README.md](./assets/example-real-photos/README.md)** — Real concert photos for testing

## Issue Drafts

- **[docs/issues/download-strip-embedded-metadata.md](./docs/issues/download-strip-embedded-metadata.md)** — Strip embedded metadata from Opus files
- **[docs/issues/audio-metadata-export.md](./docs/issues/audio-metadata-export.md)** — Capture source metadata in `.metadata.json`
- **[docs/issues/opus-bitrate-guardrails.md](./docs/issues/opus-bitrate-guardrails.md)** — Bitrate guardrails for Opus encoding

## Archive

- **[docs/archive/PARALLEL_RECOGNITION_IMPLEMENTATION.md](./docs/archive/PARALLEL_RECOGNITION_IMPLEMENTATION.md)** — Deprecated parallel multi-algorithm recognition
- **[docs/archive/ORB_OPTIMIZATION_RESEARCH.md](./docs/archive/ORB_OPTIMIZATION_RESEARCH.md)** — Historical ORB optimization research (non-operational)
- **[docs/archive/photo-recognition-research.md](./docs/archive/photo-recognition-research.md)** — Historical algorithm evaluation and early architecture options

---

## Maintenance

When adding or removing documentation files, update this index. Commit both changes together.
