# Photo Signal Architecture

📚 See [DOCUMENTATION_INDEX.md](./DOCUMENTATION_INDEX.md) for the full documentation map.

## System Summary

Photo Signal is a client-first React application that recognizes printed photos with perceptual hashing
(pHash), then plays mapped audio and shows concert metadata.

Current production architecture:

- Frontend: static site (Vite + React + TypeScript)
- Hosting: Vercel
- Audio/media delivery: Cloudflare Worker + R2
- Runtime data: versioned JSON artifacts in `public/`

## Runtime Pipeline

```text
Camera Access
  → Motion / Framing Validation
  → Photo Recognition (pHash + crop variants)
  → Concert Match
  → Audio Playback + Concert Info UI
```

## Source Structure

```text
src/
├── App.tsx                    # Orchestrator: wires modules together
├── modules/                   # Feature modules
├── services/data-service/     # Data loading + normalization + cache
├── types/index.ts             # Shared contracts
├── utils/                     # Cross-cutting helpers
└── __tests__/integration/     # Integration tests
```

## Module Boundaries

The orchestrator in `src/App.tsx` composes focused modules:

- `camera-access`: MediaStream permission and stream lifecycle
- `camera-view`: camera UI + framing overlays
- `motion-detection`: movement heuristics to stabilize recognition/playback behavior
- `photo-recognition`: frame sampling, crop/framing logic, pHash matching
- `photo-rectangle-detection`: rectangle estimation overlay for guided framing
- `audio-playback`: Howler-based playback, preload, crossfade, error handling
- `concert-info`: recognized concert metadata UI
- `gallery-layout`: landing and camera experience layout
- `debug-overlay`: diagnostics, telemetry views, test hooks
- `secret-settings`: hidden feature flags and runtime tuning controls

Design rule: modules communicate via typed props/hooks and shared types, not direct cross-module
state containers.

## Data Architecture

### Runtime artifacts

- `public/data.app.v2.json`
  - normalized entities: `artists`, `photos`, `tracks`, `entries`
- `public/data.recognition.v2.json`
  - compact recognition index keyed by concert id + hash variants

### Data service

`src/services/data-service/DataService.ts` is responsible for:

- loading `data.app.v2.json`
- validating schema (`version: 2` shape)
- normalizing to `Concert[]`
- caching and lookup maps (`byId`, `byBand`)
- telemetry counters for load attempts/failures

## Recognition Architecture

Photo recognition uses pHash with multiple robustness layers:

- framed-region analysis (aligned with camera overlay)
- exposure variants (dark/normal/bright) per image
- crop-region variants for partial/off-center photos
- configurable thresholds and timing controls via feature settings

### Dual-path execution

`usePhotoRecognition` supports two recognition paths:

- **Worker path** (preferred): hash computation runs in `recognition.worker.ts`
  off the main thread using `OffscreenCanvas` + zero-copy `ImageBitmap` transfer.
  Frame scheduling uses `requestVideoFrame` for exact per-frame cadence. Requires
  `Worker`, `OffscreenCanvas`, `createImageBitmap`, and
  `HTMLVideoElement.requestVideoFrame`.
- **Inline path** (universal fallback): hash computation runs synchronously on the
  main thread using a standard `<canvas>`. Frame scheduling uses adaptive `setTimeout`
  polling.

The active path is selected at mount via `isWorkerPipelineSupported()` in
`useRecognitionWorker.ts` and never changes mid-session. Both paths share identical
quality gating and match confirmation logic on the main thread.

See [docs/PHOTO_RECOGNITION_DEEP_DIVE.md](./docs/PHOTO_RECOGNITION_DEEP_DIVE.md) for algorithm
internals and the worker protocol.

## Playback and Media Delivery

- Playback engine: `useAudioPlayback` in `src/modules/audio-playback/` (Howler)
- Audio URLs may be local paths or remote CDN/proxy URLs
- Production audio access is mediated by Cloudflare Worker configuration in `cloudflare/worker.ts`
  and `wrangler.toml`

## Deployment Topology

### Frontend

- Built with Vite (`npm run build`)
- Deployed as static assets on Vercel (`vercel.json`)

### Edge media service

- Cloudflare Worker serves/proxies media from R2
- CORS allow-list and bucket binding configured in `wrangler.toml`

## Testing Architecture

- Unit/component tests: colocated with source (`*.test.ts` / `*.test.tsx`)
- Integration tests: `src/__tests__/integration/`
- Visual regression tests: `tests/visual/` (Playwright)
- Full quality gate: `npm run pre-commit`

Detailed commands and conventions: [TESTING.md](./TESTING.md).

## Non-Goals / Intentional Constraints

- No custom backend API for app data at runtime today (JSON artifacts are the source of truth)
- No external global state library (React hooks + module boundaries)
- No server-side rendering requirement for current product goals

## Maintenance Notes

When architecture-relevant behavior changes, update this file in the same PR as code changes.

High-signal files to cross-check during updates:

- `src/App.tsx`
- `src/types/index.ts`
- `src/services/data-service/DataService.ts`
- `vite.config.ts`
- `vitest.config.ts`
- `playwright.config.ts`
- `vercel.json`
- `wrangler.toml`
