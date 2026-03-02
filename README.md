# Photo Signal

A camera-based music gallery: point your phone at a printed photo, and the app recognizes it and plays
its paired song.

## Live Demo

- Live site: https://www.whoisduck2.com/

![Photo Signal demo](docs/media/demo.gif)

Regenerate this demo GIF programmatically with `npm run demo:gif`.

## What It Is

Photo Signal is a portfolio project about linking physical photographs to sound without QR codes or visible
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

This project is meant to signal creative direction, technical taste, and execution speed.

## How It Works

1. User grants camera access.
2. Camera frames a printed photo in a guided overlay.
3. Client-side pHash recognition matches against indexed photo hashes.
4. The app displays concert metadata and crossfades audio with Howler.

Runtime data comes from:

- `public/data.app.v2.json` (concert metadata + playback mapping)
- `public/data.recognition.v2.json` (recognition index)

## Tech Stack

- Frontend: React 19, TypeScript 5.9, Vite 7
- Styling: CSS Modules
- Audio: Howler.js (Opus playback)
- Testing: Vitest + Playwright
- Tooling: ESLint + Prettier

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

## Run Locally (Minimal)

```bash
npm install
npm run dev
```

Open `http://localhost:5173` on a mobile device and allow camera access.

## Documentation

- Architecture details: [ARCHITECTURE.md](./ARCHITECTURE.md)
- Photo recognition deep dive: [docs/PHOTO_RECOGNITION_DEEP_DIVE.md](./docs/PHOTO_RECOGNITION_DEEP_DIVE.md)
- Setup and environment: [SETUP.md](./SETUP.md)
- Docker workflow: [DOCKER.md](./DOCKER.md)
- Full documentation index: [DOCUMENTATION_INDEX.md](./DOCUMENTATION_INDEX.md)

## License

MIT © Miles Camp
