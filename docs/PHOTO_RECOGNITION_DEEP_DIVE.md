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
  → threshold + margin gate (reject ambiguous near-ties)
  → confirm path:
      - initial recognition: instant or short stability
      - active-playback switch mode: stricter candidate confirmation
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
- `checkInterval`: default `180ms`
- `recognitionDelay`: default `300ms`
- `sharpnessThreshold`: default `100`
- `glareThreshold`: default `250`
- `glarePercentageThreshold`: default `20`
- `matchMarginThreshold`: default `3` (minimum best-vs-second distance margin)
- `switchMatchMarginThreshold`: default `4` (stricter margin while switching)
- `switchDistanceThreshold`: default `8`
- `switchRecognitionDelayMultiplier`: default `1.8` (switch hold time multiplier)
- Instant confirm distances:
  - initial: `<= 5` (or 2 consecutive strong frames)
  - switch mode: `<= 3` plus 3 consecutive strong frames

## Data expectations

Runtime recognizer reads:

- `concert.photoHashes.phash: string[]`

Legacy fields such as `photoHashes.dhash` and `orbFeatures` may remain in data for historical/backfill purposes, but are not used by the runtime path.

## Debug + telemetry

`usePhotoRecognition` still emits:

- `debugInfo` (last hash, best candidate, frame stats)
- `frameQuality` (sharpness, glare, lighting)
- telemetry counters and failure categories, including ambiguity/collision outcomes
- switch decision telemetry consumed by `App` (`shownCount`, `confirmCount`, `dismissCount`, decision latency, last prompt confidence/margin snapshot)

This keeps diagnostics intact while removing algorithm-branch complexity.

## Ambiguity + switch prompt behavior (current app flow)

- Ambiguity is detected when best match is within threshold but too close to second-best (margin below configured guardrail).
- In this state, recognition emits `ambiguous-match` guidance and does **not** confirm a new concert.
- While music is already playing, app-level switch prompts are suppressed during `ambiguous-match` guidance.
- When ambiguity clears and a stronger candidate remains, the app can show a switch prompt:
  - **Confirm** → crossfade to candidate track.
  - **Keep current track** → dismiss that candidate until movement/reset changes context.

## Operational guidance

- Prefer good lighting and steady framing
- Keep rectangle detection enabled when available
- Tune threshold only after collecting failure telemetry from real camera sessions
- If false positives occur, lower threshold (stricter)
- If false negatives occur, raise threshold slightly

## Future extensions

If future audits show a need for richer matching, add a second algorithm only behind an explicit experimental flag and benchmark gate. Keep the default production path single and deterministic.
