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

- **[docs/DESIGN_SYSTEM.md](./docs/DESIGN_SYSTEM.md)** — Canonical reference for visual design tokens, color system, typography, animation vocabulary, visual effects, responsive breakpoints, and environmental effect variables
- **[docs/STATES_AND_DESIGN_LANGUAGE.md](./docs/STATES_AND_DESIGN_LANGUAGE.md)** — Canonical vocabulary of app states, recognition states, audio states, UI panels, events/triggers, and screen fields; use as the shared language for design discussions
- **[docs/PHOTO_RECOGNITION_DEEP_DIVE.md](./docs/PHOTO_RECOGNITION_DEEP_DIVE.md)** — Photo recognition algorithm, thresholds, troubleshooting, and quick reference
- **[docs/AUDIO_R2_WORKER.md](./docs/AUDIO_R2_WORKER.md)** — Cloudflare Worker audio proxy and R2 setup
- **[docs/PHOTO_SONG_ADDITION_WORKFLOW.md](./docs/PHOTO_SONG_ADDITION_WORKFLOW.md)** — Quick runbook for adding/removing a temporary single photo+song experience
- **[docs/ENVIRONMENTAL_EFFECTS_IDEAS.md](./docs/ENVIRONMENTAL_EFFECTS_IDEAS.md)** — Backlog of UI ideas driven by environmental variables (EXIF, time, audio, randomness) and their planned feature flag IDs
- **[docs/ARCHITECTURE_DECISIONS.md](./docs/ARCHITECTURE_DECISIONS.md)** — ADR-lite log of key architectural decisions and their rationale (for agents and maintainers)

## Module API Contracts

Each module has a `README.md` with its public API, responsibilities, and key files:

- **[src/modules/audio-playback/README.md](./src/modules/audio-playback/README.md)** — Howler.js playback, crossfade, bass-reactive glow
- **[src/modules/camera-access/README.md](./src/modules/camera-access/README.md)** — `getUserMedia`, permission state
- **[src/modules/camera-view/README.md](./src/modules/camera-view/README.md)** — Video display, framing overlay, rectangle overlay
- **[src/modules/concert-info/README.md](./src/modules/concert-info/README.md)** — Concert metadata overlay
- **[src/modules/debug-overlay/README.md](./src/modules/debug-overlay/README.md)** — Real-time recognition diagnostics panel
- **[src/modules/gallery-layout/README.md](./src/modules/gallery-layout/README.md)** — Top-level app layout, zine aesthetic shell
- **[src/modules/motion-detection/README.md](./src/modules/motion-detection/README.md)** — Pixel-diff motion detection
- **[src/modules/photo-recognition/README.md](./src/modules/photo-recognition/README.md)** — pHash recognition, Web Worker, telemetry
- **[src/modules/photo-rectangle-detection/README.md](./src/modules/photo-rectangle-detection/README.md)** — Computer vision rectangle detection
- **[src/modules/secret-settings/README.md](./src/modules/secret-settings/README.md)** — Feature flags, hidden settings menu

`scripts/check-module-readmes.js` runs in CI and `npm run pre-commit` to keep READMEs in sync with exports.

## Source Utilities

- **[src/utils/concert-palette.ts](./src/utils/concert-palette.ts)** — Generates a unique gig-poster color palette per concert using FNV-1a band name hash + day-of-week hue anchoring; applies/resets CSS custom properties on `<html>` for the dead signal → matched state transition

## Scripts & Workflows

- **[scripts/audio-workflow/README.md](./scripts/audio-workflow/README.md)** — Audio download/encode/upload pipeline
- **[scripts/audio-workflow/download/README.md](./scripts/audio-workflow/download/README.md)** — yt-dlp downloader guide
- **[scripts/audio-workflow/encode/README.md](./scripts/audio-workflow/encode/README.md)** — Opus encoding playbook
- **[tests/visual/README.md](./tests/visual/README.md)** — Visual regression testing guide
- **[scripts/check-module-readmes.js](./scripts/check-module-readmes.js)** — CI guardrail: verifies module READMEs mention all non-type exports
- **[scripts/cleanup-worktrees.sh](./scripts/cleanup-worktrees.sh)** — Identify and prune stale git worktrees after PR merges

## Asset Documentation

- **assets/prod-photographs/** — Local-only source photo workflow (original images are intentionally not tracked)
- **[assets/prod-photographs/prod-photographs-details.csv](./assets/prod-photographs/prod-photographs-details.csv)** — Canonical tracked photo-to-band metadata and EXIF details
- **[assets/test-videos/phone-samples/README.md](./assets/test-videos/phone-samples/README.md)** — Dev/test-only real-world phone video samples for deterministic demo GIF generation
- **[public/assets/test-images/README.md](./public/assets/test-images/README.md)** — Git-tracked synthetic image fixtures for image-dependent tests

---

## Maintenance

When adding or removing documentation files, update this index. Commit both changes together.
