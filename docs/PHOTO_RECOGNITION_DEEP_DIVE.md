# Photo Recognition Deep Dive

## Current architecture (2026 simplification)

Photo Signal now uses a **single recognition algorithm** in runtime:

- **pHash only** (`src/modules/photo-recognition/algorithms/phash.ts`)

Removed from runtime:

- dHash matching path
- ORB matching path
- Parallel recognizer voting path
- Secondary fallback algorithm path
- Multi-scale branching path

This reduction is intentional: one deterministic path is easier to tune, debug, and maintain.

## Runtime pipeline

```text
Camera frame
  → quality filter (blur / glare / lighting)
  → crop region (rectangle detection when confident, else centered frame)
  → pHash compute
  → Hamming distance against all concert pHash variants
  → threshold check
  → stability timer
  → recognized concert
```

## Why pHash

From the project audit:

- pHash and dHash both passed the reference-image sanity check
- pHash remained comfortably fast for runtime use
- pHash is generally more robust to lighting/perspective variance than dHash
- ORB strict mode was too expensive for practical frame-by-frame runtime behavior

## Key thresholds

- `similarityThreshold`: default `12` (pHash distance)
- `checkInterval`: default `250ms`
- `recognitionDelay`: default `1000ms`
- `sharpnessThreshold`: default `100`
- `glareThreshold`: default `250`
- `glarePercentageThreshold`: default `20`

## Data expectations

Runtime recognizer reads:

- `concert.photoHashes.phash: string[]`

Legacy fields such as `photoHashes.dhash` and `orbFeatures` may remain in data for historical/backfill purposes, but are not used by the runtime path.

## Debug + telemetry

`usePhotoRecognition` still emits:

- `debugInfo` (last hash, best candidate, frame stats)
- `frameQuality` (sharpness, glare, lighting)
- telemetry counters and failure categories

This keeps diagnostics intact while removing algorithm-branch complexity.

## Operational guidance

- Prefer good lighting and steady framing
- Keep rectangle detection enabled when available
- Tune threshold only after collecting failure telemetry from real camera sessions
- If false positives occur, lower threshold (stricter)
- If false negatives occur, raise threshold slightly

## Future extensions

If future audits show a need for richer matching, add a second algorithm only behind an explicit experimental flag and benchmark gate. Keep the default production path single and deterministic.
