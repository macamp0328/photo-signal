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

- `similarityThreshold`: default `14` (pHash distance)
- `checkInterval`: default `120ms` idle, adaptive `80ms` while tracking a candidate
- `recognitionDelay`: default `200ms`
- `sharpnessThreshold`: default `100`
- `glareThreshold`: default `250`
- `glarePercentageThreshold`: default `20`
- `matchMarginThreshold`: default `3` (plus dynamic `+1` near threshold edge)
- `switchMatchMarginThreshold`: default `6` (plus dynamic `+1` near threshold edge)
- `switchDistanceThreshold`: default `7`
- `switchRecognitionDelayMultiplier`: default `1.8` (switch hold time multiplier)
- `rectangleConfidenceThreshold`: default `0.35` (minimum confidence for perspective crop)
- Instant confirm distances:
  - initial: `<= 10` (or 2 consecutive strong frames)
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
- collision diagnostics: ambiguous vs near-threshold collisions, margin histogram, and top ambiguous band pairs
- switch decision telemetry consumed by `App` (`shownCount`, `confirmCount`, `dismissCount`, decision latency, last prompt confidence/margin snapshot)

## Iterative tuning loop (recommended)

Use this loop when validating field performance on real devices:

1. Capture two 30s telemetry exports in Test Mode from the same environment/device.
2. Compare `collisionStats` (`ambiguousMarginHistogram`, `topAmbiguousPairs`, `ambiguousCount`).
3. If collisions are low-margin dominated (`0-1` / `2` bins), raise `matchMarginThreshold` by 1.
4. If collisions are not low-margin dominated, prioritize hash refresh and print/image alignment checks.
5. Re-run the offline audit script using runtime-aligned settings:

```bash
node scripts/recognition-accuracy-test.js --threshold 14 --margin-threshold 3 --summary-json tmp/recognition-audit.json
```

6. Repeat until collision rate and recognition success meet acceptance targets.

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
- Mobile tuning baseline:
  - iPhone Safari: keep defaults, prioritize stability over aggressive switching.
  - Android Chrome: defaults are balanced; only relax switch distance to `8` for very sparse layouts.

## Future extensions

If future audits show a need for richer matching, add a second algorithm only behind an explicit experimental flag and benchmark gate. Keep the default production path single and deterministic.

---

## Quick reference

### Adding hashes to data.json

**Camera capture method (preferred):**

1. Enable Test Mode (triple-tap → "Test Data Mode")
2. Point camera at the photo; wait for "Good" quality indicator
3. Copy hash from debug overlay (`Frame Hash` field)
4. Add to `data.json` under `photoHashes.phash`

**Script method:**

```bash
# Place photos in assets/reference-photos/
npm run hashes:paths

# Target specific paths
npm run hashes:paths -- --paths assets/example-real-photos,assets/new-print-tests

# Rebuild all hashes
npm run hashes:refresh -- --hashes-only
```

**Multi-exposure strategy** — capture 3 hashes per photo (bright / normal / dim lighting):

```json
{
  "photoHashes": {
    "phash": ["hash-bright", "hash-normal", "hash-dim"]
  }
}
```

### Hamming distance → similarity

| Distance | Similarity | Interpretation     |
| -------- | ---------- | ------------------ |
| 0        | 100%       | Exact match        |
| 0–10     | >84%       | Strong match       |
| 11–14    | >78%       | Borderline (delay) |
| 15–20    | >69%       | Below threshold    |
| >30      | <53%       | Hash mismatch      |

### Troubleshooting

| Symptom                | Diagnosis                             | Fix                                          |
| ---------------------- | ------------------------------------- | -------------------------------------------- |
| Not recognized         | Distance >30                          | Regenerate hash via camera capture           |
| Not recognized         | Distance 11–20                        | Increase `similarityThreshold` by 2–4        |
| Wrong photo recognized | Two hashes too similar                | Decrease `similarityThreshold` by 2          |
| >30% blur rejections   | Camera shake or threshold too strict  | Decrease `sharpnessThreshold` (try 80)       |
| >25% glare rejections  | Lighting or photo surface             | Increase `glarePercentageThreshold` (try 30) |
| Slow recognition (>5s) | `recognitionDelay` or `checkInterval` | Lower `recognitionDelay` (try 800)           |

### Common failure categories

| Category     | Cause                    | Fix                                            |
| ------------ | ------------------------ | ---------------------------------------------- |
| motion-blur  | Camera shake             | Lower `sharpnessThreshold`, hold steadier      |
| glare        | Specular reflections     | Adjust lighting, tilt photo, raise threshold   |
| no-match     | Hash not in database     | Regenerate hash, raise `similarityThreshold`   |
| collision    | Multiple similar matches | Lower `similarityThreshold`, use distinct refs |
| poor-quality | Low-quality frame        | Improve lighting, check camera                 |

### Telemetry health thresholds

| Metric             | Healthy | Investigate |
| ------------------ | ------- | ----------- |
| Quality frame rate | >70%    | <60%        |
| Blur rejections    | <20%    | >30%        |
| Glare rejections   | <15%    | >25%        |
| Recognition rate   | >85%    | <70%        |
