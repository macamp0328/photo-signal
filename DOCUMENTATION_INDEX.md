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

- **[docs/PHOTO_RECOGNITION_DEEP_DIVE.md](./docs/PHOTO_RECOGNITION_DEEP_DIVE.md)** — Photo recognition algorithm, thresholds, troubleshooting, and quick reference
- **[docs/camera-settings-guide.md](./docs/camera-settings-guide.md)** — Camera API, browser support, low-light optimization
- **[docs/telemetry-interpretation-guide.md](./docs/telemetry-interpretation-guide.md)** — Recognition telemetry and debugging
- **[docs/AUDIO_R2_WORKER.md](./docs/AUDIO_R2_WORKER.md)** — Cloudflare Worker audio proxy and R2 setup
- **[docs/TEST_DATA_MODE_GUIDE.md](./docs/TEST_DATA_MODE_GUIDE.md)** — Test data mode user guide
- **[docs/code-analysis-tooling-guide.md](./docs/code-analysis-tooling-guide.md)** — CodeQL, Codecov, npm audit guide
- **[docs/vercel-setup-guide.md](./docs/vercel-setup-guide.md)** — Vercel deployment guide

## Accessibility

- **[docs/ACCESSIBILITY.md](./docs/ACCESSIBILITY.md)** — WCAG 2.1 Level AA standards, color palette, and developer quick reference

## Module API Contracts

Module API contracts live in the TypeScript source — see `types.ts` in each module directory.

- **[src/modules/secret-settings/DEVELOPER_GUIDE.md](./src/modules/secret-settings/DEVELOPER_GUIDE.md)** — Adding feature flags and custom settings
- **[src/services/data-service/README.md](./src/services/data-service/README.md)** — Concert data loading and caching

## Scripts & Workflows

- **[scripts/README.md](./scripts/README.md)** — Helper scripts documentation
- **[scripts/audio-workflow/README.md](./scripts/audio-workflow/README.md)** — Audio download/encode/upload pipeline
- **[scripts/audio-workflow/download/README.md](./scripts/audio-workflow/download/README.md)** — yt-dlp downloader guide
- **[scripts/audio-workflow/encode/README.md](./scripts/audio-workflow/encode/README.md)** — Opus encoding playbook
- **[tests/visual/README.md](./tests/visual/README.md)** — Visual regression testing guide

## Asset Documentation

- **assets/prod-photographs/** — Canonical production photo source materials
- **[assets/prod-photographs/prod-photographs-details.csv](./assets/prod-photographs/prod-photographs-details.csv)** — Canonical photo-to-band metadata and EXIF details

---

## Maintenance

When adding or removing documentation files, update this index. Commit both changes together.
