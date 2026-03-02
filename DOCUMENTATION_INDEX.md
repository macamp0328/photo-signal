# Documentation Index

> Central index of all project documentation.

---

## Core Documentation

- **[README.md](./README.md)** — Project overview, features, and setup
- **[SETUP.md](./SETUP.md)** — Development environment, CI/CD, DevContainer, Vercel deployment
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** — System architecture, module structure, data flow, design principles
- **[TESTING.md](./TESTING.md)** — Testing strategy, framework, and coverage goals
- **[DOCKER.md](./DOCKER.md)** — Docker and Docker Compose setup

## AI Agent Instructions

- **[CLAUDE.md](./CLAUDE.md)** — Claude Code agent instructions
- **[.github/copilot-instructions.md](./.github/copilot-instructions.md)** — GitHub Copilot agent instructions

## Technical Guides

- **[docs/PHOTO_RECOGNITION_DEEP_DIVE.md](./docs/PHOTO_RECOGNITION_DEEP_DIVE.md)** — Photo recognition algorithm, thresholds, troubleshooting, and quick reference
- **[docs/AUDIO_R2_WORKER.md](./docs/AUDIO_R2_WORKER.md)** — Cloudflare Worker audio proxy and R2 setup

## Module API Contracts

Module API contracts live in the TypeScript source — see `types.ts` in each module directory.

## Scripts & Workflows

- **[scripts/audio-workflow/README.md](./scripts/audio-workflow/README.md)** — Audio download/encode/upload pipeline
- **[scripts/audio-workflow/download/README.md](./scripts/audio-workflow/download/README.md)** — yt-dlp downloader guide
- **[scripts/audio-workflow/encode/README.md](./scripts/audio-workflow/encode/README.md)** — Opus encoding playbook
- **[tests/visual/README.md](./tests/visual/README.md)** — Visual regression testing guide

## Asset Documentation

- **assets/prod-photographs/** — Local-only source photo workflow (original images are intentionally not tracked)
- **[assets/prod-photographs/prod-photographs-details.csv](./assets/prod-photographs/prod-photographs-details.csv)** — Canonical tracked photo-to-band metadata and EXIF details
- **[assets/test-images/README.md](./assets/test-images/README.md)** — Git-tracked synthetic image fixtures for image-dependent tests

---

## Maintenance

When adding or removing documentation files, update this index. Commit both changes together.
