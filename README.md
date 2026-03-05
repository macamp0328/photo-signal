# Photo Signal

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/macamp0328/photo-signal)

A camera-based music gallery: point your phone at a printed photo, and the app recognizes it and plays
its paired song.

## Live Demo

- Live site: https://www.whoisduck2.com/

![Photo Signal demo](docs/media/demo.gif)

Regenerate this demo GIF programmatically with `npm run demo:gif`.

## What It Is

Photo Signal is a project about linking physical photographs to sound without QR codes or visible
markers. The experience is mobile-first and designed to feel quiet: frame a printed photo, get a match,
see concert context, hear the song.

## Project Intent

- Built primarily with AI coding agents as an experiment in shipping a production-style app while rarely
  writing code directly by hand.
- Part of a personal art project paired with a physical gallery wall of ~100 photographs I shot across
  multiple years of SXSW performances.
- Intentionally over-engineered so the core recognition + metadata + playback services can be reused for
  other content types and mediums.
- Designed so it could be extended into a multi-user product where people maintain their own collections
  of recognizable photos paired with audio.

## How It Works

1. User grants camera access.
2. Camera frames a printed photo in a guided overlay.
3. Client-side pHash recognition matches against indexed photo hashes.
4. The app displays concert metadata and crossfades audio with Howler.

Runtime data comes from:

- `public/data.app.v2.json` (concert metadata + playback mapping)
- `public/data.recognition.v2.json` (recognition index)

Production source photo originals under `assets/prod-photographs/` are intentionally local-only and
not tracked in git. Runtime display uses `photoUrl` values in `data.app.v2.json` (Cloudflare Worker/CDN
paths), while `imageFile` entries are retained as metadata/workflow references.

## Standout Features

- Client-side pHash recognition tuned for real-world print/photo conditions (lighting variance, motion,
  and framing drift).
- Dynamic rectangle detection mode that can auto-crop to detected photo boundaries instead of relying
  only on fixed guides.
- Mobile-first visual behavior with PWA metadata (`standalone`, portrait orientation, installable icon
  set).

## Tech Stack

- Frontend: React 19, TypeScript 5.9, Vite 7
- Styling: CSS Modules
- Audio: Howler.js (Opus playback)
- Testing: Vitest + Playwright
- Tooling: ESLint + Prettier

## Quality and CI Guardrails

- Local quality gate: `npm run pre-commit` (lint fix, format, type-check, unit tests, production build,
  bundle-size check).
- CI workflow on `main` and pull requests runs lint, format check, type-check, coverage, build, artifact
  validation, and bundle-size checks.
- Visual regression suite covers mobile browsers (Mobile Chrome + Mobile Safari) with strict screenshot
  diff tolerance.

## Architecture Snapshot

Pipeline:

`Camera Access → Motion/Frame Validation → Photo Recognition (pHash) → Audio Playback + Concert Info`

Feature modules live in `src/modules/` and include:

- `camera-access`, `camera-view`, `motion-detection`
- `photo-rectangle-detection`, `photo-recognition`
- `audio-playback`, `concert-info`, `debug-overlay`, `secret-settings`

## Deployment and Services

- Frontend hosting: Vercel (static site)
- Audio + protected asset proxy: Cloudflare Worker + Cloudflare R2

## Data and Media Tooling

- Recognition index refresh for the photo dataset: `npm run hashes:refresh`.
- End-to-end audio pipeline orchestration (download, encode, upload, dataset remap/validation):
  `npm run audio:clean-slate`.
- Audio URL verification and troubleshooting utilities: `npm run validate-audio` and
  `npm run trace-audio`.

## Access Protection Note

This project includes a small password barrier before full app access. Its purpose is practical abuse
control: it reduces anonymous bot traffic and helps protect Cloudflare Worker/R2 usage from accidental
cost spikes during automated scanning or DDoS-style traffic bursts.

This gate is not intended as a strong authentication system for user accounts. It is a lightweight
front-door control for a private/home deployment context.

## Content Ownership and Audio Usage

All photographs in this project are original images captured for this project.

The paired audio tracks are not owned by this project's authors or maintainers and remain the property of
their respective rights holders.

From a technical perspective, the project includes a small audio pipeline script that automates
playlist-based ingest using common open-source tooling, then transcodes files to a web-friendly format
and publishes them to a private storage path used by this app.

That implementation is presented as an engineering feature (automation, encoding, and delivery), not as
proof of content ownership or redistribution rights.

In this setup, playback is intended for private, in-home personal use (similar to listening through an
individual YouTube Music account while using the gallery).

If you plan to deploy this project publicly, you should replace all audio with content you are licensed
to use and/or distribute, and ensure your use complies with applicable copyright rules and platform
terms.

## Open in GitHub Codespaces

One-click launch:

- https://codespaces.new/macamp0328/photo-signal

First-run in Codespaces:

```bash
npm run dev
```

Optional (only if you need audio pipeline tooling inside Codespaces/devcontainer):

```bash
bash scripts/dev/install-audio-tools.sh
```

## Run Locally (Minimal)

```bash
npm ci
npm run dev
```

Open `http://localhost:5173` on a mobile device and allow camera access.

For container-based development, see [DOCKER.md](./DOCKER.md) and the included
`.devcontainer/devcontainer.json` setup.

## Documentation

- Architecture details: [ARCHITECTURE.md](./ARCHITECTURE.md)
- Photo recognition deep dive: [docs/PHOTO_RECOGNITION_DEEP_DIVE.md](./docs/PHOTO_RECOGNITION_DEEP_DIVE.md)
- Setup and environment: [SETUP.md](./SETUP.md)
- Docker workflow: [DOCKER.md](./DOCKER.md)
- Full documentation index: [DOCUMENTATION_INDEX.md](./DOCUMENTATION_INDEX.md)

## License

MIT © Miles Camp
