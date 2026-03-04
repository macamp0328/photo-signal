# Photo Recognition Deep Dive

## Runtime Model (Current)

Photo Signal uses a single recognition algorithm:

- pHash only (`src/modules/photo-recognition/algorithms/phash.ts`)

Recognition runs continuously while camera view is active and recognition is enabled.

## Dual-Path Architecture

`usePhotoRecognition` supports two execution paths that share identical recognition
logic but differ in how they schedule frames and run the hash pipeline:

### Worker path (preferred on supporting browsers)

- Requires: `Worker`, `OffscreenCanvas`, `createImageBitmap`,
  `HTMLVideoElement.requestVideoFrame`
- Detected at mount by `isWorkerPipelineSupported()` in `useRecognitionWorker.ts`
- Frame scheduling: `requestVideoFrame` — fires once per new decoded video frame,
  eliminating duplicate processing and achieving higher throughput than polling
- Hash computation: runs entirely in `recognition.worker.ts` off the main thread
  via `OffscreenCanvas` + `ImageBitmap` transfer (zero-copy)
- Quality metrics and match confirmation run on the main thread after the worker
  posts its `WorkerFrameResult` — using adaptive thresholds computed there

### Inline path (universal fallback)

- Always available; used when the Worker API set is absent or `enabled=false`
- Frame scheduling: adaptive `setTimeout` polling (80 ms tracking, 120 ms idle)
- Hash computation: synchronous on the main thread using a regular `<canvas>`

The scheduling loop (`requestVideoFrame` vs `setTimeout`) is set up once at effect
mount and never restarts, even when the worker transitions from initialising to
ready — `isWorkerReady` is read via a ref at per-frame time so the video element
and canvas are never recreated unnecessarily.

## Pipeline

```text
Camera frame
  → framed/cropped region selection
  → pHash (64-bit)  ← off-thread on worker path, main-thread on inline path
  → candidate lookup from /data.recognition.v2.json
  → Hamming distance ranking
  → threshold + margin gate
  → adaptive quality gating (blur / glare / lighting — always on main thread)
  → stability/instant-confirm logic
  → recognized concert (or categorized failure)
```

## Worker Protocol (`worker-protocol.ts`)

| Message (main → worker) | Purpose                                                             |
| ----------------------- | ------------------------------------------------------------------- |
| `init`                  | Load hash index + initial config; worker replies with `ready`       |
| `config-update`         | Live-tune thresholds without reloading hashes                       |
| `frame`                 | Transfer `ImageBitmap` for processing; worker replies with `result` |

| Message (worker → main) | Purpose                                                                           |
| ----------------------- | --------------------------------------------------------------------------------- |
| `ready`                 | Hash DB loaded; `hashCount` confirms entry count                                  |
| `result`                | `WorkerFrameResult`: hash string, best/second-best match, quality metrics, timing |
| `error`                 | Unhandled exception details                                                       |

## Data Inputs

Runtime uses:

- `public/data.app.v2.json` (metadata + playback mapping)
- `public/data.recognition.v2.json` (recognition hash index)

`usePhotoRecognition` loads both and normalizes candidate matching by concert id.

## Active Thresholds

### Hook defaults (`usePhotoRecognition`)

- `similarityThreshold`: `14`
- `matchMarginThreshold`: `4`
- `recognitionDelay`: `150ms`
- `checkInterval`: `120ms` idle (adaptive faster cadence while tracking candidates)
- `sharpnessThreshold`: `100`
- `glareThreshold`: `250`
- `glarePercentageThreshold`: `20`
- `minBrightness`: `50`
- `maxBrightness`: `220`
- `rectangleConfidenceThreshold`: `0.35`

### App runtime overrides (`src/App.tsx`)

The app currently passes:

- `similarityThreshold: 18`
- `matchMarginThreshold: 5`
- `recognitionDelay: 180ms`
- `sharpnessThreshold: 85`
- `continuousRecognition: true`
- `enableRectangleDetection`: feature-flag controlled

This means field behavior follows these app-provided values, not raw hook defaults.

## Confirmation Behavior

- Very strong matches can confirm immediately (instant path).
- Borderline-but-valid matches use dwell-time confirmation (`recognitionDelay`).
- Ambiguous matches (insufficient best-vs-second margin) are rejected as collision/no-match outcomes.

## Quality Gating

Frames are filtered before confirmation using:

- blur/sharpness
- glare percentage
- lighting bounds

Adaptive quality thresholds are derived from ambient frame trends to reduce false rejections in changing lighting.

## Telemetry Output

`debugInfo` and telemetry include:

- frame quality metrics
- best/second-best match and margin
- categorized failures (`motion-blur`, `glare`, `poor-quality`, `no-match`, `collision`)
- collision diagnostics (`ambiguousMarginHistogram`, recurring pair counts)

## Practical Tuning Workflow

1. Enable Debug Overlay and capture telemetry in the target environment.
2. Check dominant failure category.
3. Adjust one parameter at a time.
4. Re-test in the same environment/device.
5. Keep changes only if false positives/false negatives improve without regression.

Useful local audit command:

```bash
node scripts/recognition-accuracy-test.js --threshold 18 --margin-threshold 5 --summary-json tmp/recognition-audit.json
```

## Hash Maintenance

Primary scripts:

```bash
npm run hashes:paths
npm run hashes:refresh
```

Use multi-exposure hash sets (dark/normal/bright variants) for print + lighting robustness.

## Troubleshooting Quick Guide

- Frequent `motion-blur` failures: lower `sharpnessThreshold` incrementally or improve camera stability.
- Frequent `glare` failures: improve lighting angle and/or raise `glarePercentageThreshold` slightly.
- Frequent `no-match` with near misses: increase `similarityThreshold` carefully.
- Frequent `collision`: increase `matchMarginThreshold` or refresh hashes for visually similar prints.
