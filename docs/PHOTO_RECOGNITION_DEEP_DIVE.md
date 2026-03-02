# Photo Recognition Deep Dive

## Runtime Model (Current)

Photo Signal uses a single runtime recognizer:

- pHash only (`src/modules/photo-recognition/algorithms/phash.ts`)

Recognition runs continuously while camera view is active and recognition is enabled.

## Pipeline

```text
Camera frame
  → framed/cropped region selection
  → pHash (64-bit)
  → candidate lookup from /data.recognition.v2.json
  → Hamming distance ranking
  → threshold + margin gate
  → stability/instant-confirm logic
  → recognized concert (or categorized failure)
```

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
